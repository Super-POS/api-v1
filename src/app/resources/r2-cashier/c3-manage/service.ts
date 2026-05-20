// =========================================================================>> Core Library
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';

// =========================================================================>> Third Party Library
import { Op } from 'sequelize';

// =========================================================================>> Custom Library
import { OrderChannelEnum } from '@app/enums/order-channel.enum';
import { OrderStatusEnum }  from '@app/enums/order-status.enum';
import OrderDetails         from '@app/models/order/detail.model';
import OrderDetailModifier  from '@app/models/order/order-detail-modifier.model';
import Order                from '@app/models/order/order.model';
import Menu              from '@app/models/menu/menu.model';
import MenuType          from '@app/models/menu/menu-type.model';
import User                 from '@app/models/user/user.model';
import { OrderService }   from '../c1-order/service';
import { TelegramService } from '@app/services/telegram.service';

const ORDER_ATTRIBUTES  = [
    'id',
    'receipt_number',
    'order_number',
    'total_price',
    'channel',
    'status',
    'ordered_at',
    'coupon_code',
    'discount_percent',
    'discount_amount',
];
const DETAIL_INCLUDES   = [
    {
        model: OrderDetails,
        attributes: ['id', 'unit_price', 'qty', 'line_note'],
        include: [
            {
                model: Menu,
                attributes: ['id', 'name', 'code', 'image'],
                include: [{ model: MenuType, attributes: ['name'] }],
            },
            {
                model: OrderDetailModifier,
                as: 'detailModifiers',
                attributes: ['group_name', 'option_label'],
            },
        ],
    },
    { model: User, as: 'cashier', attributes: ['id', 'avatar', 'name'] },
    { model: User, as: 'customer', attributes: ['id', 'avatar', 'name', 'telegram_first_name', 'telegram_last_name', 'telegram_username'] },
];

const WEBSITE_OR_TELEGRAM: OrderChannelEnum[] = [
    OrderChannelEnum.WEBSITE,
    OrderChannelEnum.TELEGRAM,
];

@Injectable()
export class ManageService {

    private readonly logger = new Logger(ManageService.name);

    constructor(
        private readonly _orderService: OrderService,
        private readonly _telegram: TelegramService,
    ) {}

    /** Website + Telegram orders: full pipeline including completed (still listed for reference; also on Sales). */
    async getIncomingWebsiteOrders() {
        const data = await Order.findAll({
            attributes : ORDER_ATTRIBUTES,
            include    : DETAIL_INCLUDES,
            where      : {
                channel: { [Op.in]: WEBSITE_OR_TELEGRAM },
                status   : {
                    [Op.in]: [
                        OrderStatusEnum.PENDING,
                        OrderStatusEnum.AWAITING_PAYMENT,
                        OrderStatusEnum.PREPARING,
                        OrderStatusEnum.READY,
                        OrderStatusEnum.COMPLETED,
                    ],
                },
            },
            order      : [['ordered_at', 'DESC']],
        });

        return { data };
    }

    async getOrders(status?: OrderStatusEnum) {
        const where: any = {};
        if (status) {
            where.status = status;
        } else {
            // Hidden until Baray (or other) payment clears — same as kitchen / active queue
            where.status = {
                [Op.notIn]: [
                    OrderStatusEnum.COMPLETED,
                    OrderStatusEnum.CANCELLED,
                    OrderStatusEnum.AWAITING_PAYMENT,
                ],
            };
        }

        const data = await Order.findAll({
            attributes : ORDER_ATTRIBUTES,
            include    : DETAIL_INCLUDES,
            where,
            order      : [['ordered_at', 'ASC']],
        });

        return { data };
    }

    async accept(id: number, staffUserId: number) {
        return this._transition(id, [OrderStatusEnum.PENDING], OrderStatusEnum.PREPARING, 'accepted', staffUserId);
    }

    async start(id: number, staffUserId: number) {
        return this._transition(id, [OrderStatusEnum.PENDING], OrderStatusEnum.PREPARING, 'started', staffUserId);
    }

    async ready(id: number, staffUserId: number) {
        return this._transition(id, [OrderStatusEnum.PREPARING], OrderStatusEnum.READY, 'marked as ready', staffUserId);
    }

    async complete(id: number, staffUserId: number) {
        return this._transition(id, [OrderStatusEnum.READY], OrderStatusEnum.COMPLETED, 'completed', staffUserId);
    }

    /**
     * Web orders queue: cashier finishes prep in one step (preparing or ready → completed).
     * Other channels keep the kitchen ready → complete flow via `ready` + `complete`.
     */
    async finishWebsite(id: number, staffUserId: number) {
        const order = await Order.findByPk(id, {
            attributes: ['id', 'status', 'channel'],
        });
        if (!order) {
            throw new NotFoundException(`Order #${id} not found.`);
        }
        if (!WEBSITE_OR_TELEGRAM.includes(order.channel as OrderChannelEnum)) {
            throw new BadRequestException('This action is only for website or Telegram orders.');
        }
        if (
            order.status !== OrderStatusEnum.PREPARING
            && order.status !== OrderStatusEnum.READY
        ) {
            throw new BadRequestException(
                `Cannot finish from status '${order.status}'. Expected preparing or ready.`,
            );
        }
        return this._transition(
            id,
            [OrderStatusEnum.PREPARING, OrderStatusEnum.READY],
            OrderStatusEnum.COMPLETED,
            'completed',
            staffUserId,
        );
    }

    async cancel(id: number, staffUserId: number) {
        const out = await this._transition(
            id,
            [
                OrderStatusEnum.AWAITING_PAYMENT,
                OrderStatusEnum.PENDING,
                OrderStatusEnum.PREPARING,
                OrderStatusEnum.READY,
            ],
            OrderStatusEnum.CANCELLED,
            'cancelled',
            staffUserId,
        );
        try {
            await this._orderService.sendOrderCancelledTelegram(id);
        } catch {
            // optional channel
        }
        return out;
    }

    private async _transition(
        id: number,
        allowedFrom: OrderStatusEnum[],
        toStatus: OrderStatusEnum,
        verb: string,
        staffUserId: number,
    ) {
        const order = await Order.findByPk(id, { attributes: ['id', 'status', 'cashier_id'] });

        if (!order) {
            throw new NotFoundException(`Order #${id} not found.`);
        }

        if (!allowedFrom.includes(order.status)) {
            throw new BadRequestException(
                `Cannot transition order from '${order.status}' status. Expected: ${allowedFrom.join(' or ')}.`,
            );
        }

        const payload: { status: OrderStatusEnum; cashier_id?: number } = { status: toStatus };
        if (order.cashier_id == null) {
            payload.cashier_id = staffUserId;
        }

        await order.update(payload);

        // Telegram customer push (Mini App / web orders use WEBSITE channel but customer still has telegram_user_id)
        try {
            const full = await Order.findByPk(id, {
                attributes: ['id', 'receipt_number', 'order_number', 'status', 'channel', 'customer_id', 'total_price'],
                include: [{ model: User, as: 'customer', attributes: ['id', 'name', 'telegram_user_id'] }],
            });
            const tgId = full?.customer?.telegram_user_id;
            if (full && WEBSITE_OR_TELEGRAM.includes(full.channel) && tgId) {
                let text: string;
                if (verb === 'accepted') {
                    const orderNo =
                        full.order_number != null && Number.isFinite(Number(full.order_number))
                            ? String(Math.floor(Number(full.order_number))).padStart(3, '0')
                            : '—';
                    const total = Number(full.total_price ?? 0);
                    const totalFmt = `${Math.round(total).toLocaleString('en-US')} KHR`;
                    text =
                        `<b>Order accepted</b>\n` +
                        `Order #: <code>${orderNo}</code>\n` +
                        `Receipt: <code>#${full.receipt_number}</code>\n` +
                        `Amount to pay: <b>${totalFmt}</b>\n\n` +
                        `Complete payment when you are ready.`;
                } else if (toStatus === OrderStatusEnum.READY) {
                    text =
                        `<b>Ready for pickup</b>\n` +
                        `Receipt: <code>#${full.receipt_number}</code>`;
                } else if (toStatus === OrderStatusEnum.COMPLETED && WEBSITE_OR_TELEGRAM.includes(full.channel as OrderChannelEnum)) {
                    text =
                        `<b>Order completed</b>\n` +
                        `Receipt: <code>#${full.receipt_number}</code>\n` +
                        `Thank you for your order!`;
                } else {
                    const statusLabel = String(toStatus);
                    text =
                        `<b>Order update</b>\n` +
                        `Receipt: <code>#${full.receipt_number}</code>\n` +
                        `Status: <b>${statusLabel}</b>`;
                }
                await this._telegram.sendHTMLToChat(tgId, text);
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Telegram customer notify failed order_id=${id}: ${msg}`);
        }

        const data = await Order.findByPk(id, {
            attributes : ORDER_ATTRIBUTES,
            include    : DETAIL_INCLUDES,
        });

        return { data, message: `Order #${id} has been ${verb} successfully.` };
    }
}
