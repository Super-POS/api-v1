// =========================================================================>> Core Library
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

// =========================================================================>> Third Party Library
import { Op } from 'sequelize';

// =========================================================================>> Custom Library
import { OrderChannelEnum } from '@app/enums/order-channel.enum';
import { OrderStatusEnum }  from '@app/enums/order-status.enum';
import OrderDetails         from '@app/models/order/detail.model';
import Order                from '@app/models/order/order.model';
import Menu              from '@app/models/menu/menu.model';
import MenuType          from '@app/models/menu/menu-type.model';
import User                 from '@app/models/user/user.model';
import { OrderService }   from '../c1-order/service';
import { TelegramService } from '@app/services/telegram.service';

const ORDER_ATTRIBUTES  = ['id', 'receipt_number', 'total_price', 'channel', 'status', 'ordered_at'];
const DETAIL_INCLUDES   = [
    {
        model: OrderDetails,
        attributes: ['id', 'unit_price', 'qty'],
        include: [
            {
                model: Menu,
                attributes: ['id', 'name', 'code', 'image'],
                include: [{ model: MenuType, attributes: ['name'] }],
            },
        ],
    },
    { model: User, as: 'cashier', attributes: ['id', 'avatar', 'name'] },
    { model: User, as: 'customer', attributes: ['id', 'avatar', 'name'] },
];

@Injectable()
export class ManageService {

    constructor(
        private readonly _orderService: OrderService,
        private readonly _telegram: TelegramService,
    ) {}

    /** Orders placed from customer_web (`website` channel) still waiting on payment or cashier accept. */
    async getIncomingWebsiteOrders() {
        const data = await Order.findAll({
            attributes : ORDER_ATTRIBUTES,
            include    : DETAIL_INCLUDES,
            where      : {
                channel: OrderChannelEnum.WEBSITE,
                status   : {
                    [Op.in]: [
                        OrderStatusEnum.PENDING,
                        OrderStatusEnum.AWAITING_PAYMENT,
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

    async accept(id: number) {
        return this._transition(id, [OrderStatusEnum.PENDING], OrderStatusEnum.PREPARING, 'accepted');
    }

    async start(id: number) {
        return this._transition(id, [OrderStatusEnum.PENDING], OrderStatusEnum.PREPARING, 'started');
    }

    async ready(id: number) {
        return this._transition(id, [OrderStatusEnum.PREPARING], OrderStatusEnum.READY, 'marked as ready');
    }

    async complete(id: number) {
        return this._transition(id, [OrderStatusEnum.READY], OrderStatusEnum.COMPLETED, 'completed');
    }

    async cancel(id: number) {
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
    ) {
        const order = await Order.findByPk(id, { attributes: ['id', 'status'] });

        if (!order) {
            throw new NotFoundException(`Order #${id} not found.`);
        }

        if (!allowedFrom.includes(order.status)) {
            throw new BadRequestException(
                `Cannot transition order from '${order.status}' status. Expected: ${allowedFrom.join(' or ')}.`,
            );
        }

        await order.update({ status: toStatus });

        // Telegram customer push (optional)
        try {
            const full = await Order.findByPk(id, {
                attributes: ['id', 'receipt_number', 'status', 'channel', 'customer_id'],
                include: [{ model: User, as: 'customer', attributes: ['id', 'name', 'telegram_user_id'] }],
            });
            if (
                full?.channel === OrderChannelEnum.TELEGRAM
                && full.customer
                && full.customer.telegram_user_id
            ) {
                const statusLabel = String(toStatus);
                const text =
                    toStatus === OrderStatusEnum.READY
                        ? `🎉 <b>Your order is ready for pickup</b>\nReceipt: <code>#${full.receipt_number}</code>`
                        : `ℹ️ <b>Order update</b>\nReceipt: <code>#${full.receipt_number}</code>\nStatus: <b>${statusLabel}</b>`;
                await this._telegram.sendHTMLToChat(full.customer.telegram_user_id, text);
            }
        } catch {
            // optional channel
        }

        const data = await Order.findByPk(id, {
            attributes : ORDER_ATTRIBUTES,
            include    : DETAIL_INCLUDES,
        });

        return { data, message: `Order #${id} has been ${verb} successfully.` };
    }
}
