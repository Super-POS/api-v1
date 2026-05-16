// =========================================================================>> Core Library
import { BadRequestException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';

// =========================================================================>> Third Party Library
import { Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

// =========================================================================>> Custom Library
import { OrderStatusEnum }  from '@app/enums/order-status.enum';
import { OrderChannelEnum } from '@app/enums/order-channel.enum';
import OrderDetails         from '@app/models/order/detail.model';
import Order                from '@app/models/order/order.model';
import Menu              from '@app/models/menu/menu.model';
import MenuType          from '@app/models/menu/menu-type.model';
import { deductStockForMenuRecipeLines, deductStockForModifierOptionRecipes } from '@app/utils/menu-recipe-stock.util';
import OrderDetailModifier from '@app/models/order/order-detail-modifier.model';
import {
    buildLineModifiers,
    createDetailModifiers,
    getMenuCatalogInclude,
    normalizeCartLines,
    toPlainMenuWithSortedModifiers,
} from '@app/utils/modifier-order.util';
import Coupon               from '@app/models/coupon/coupon.model';
import User                 from '@app/models/user/user.model';
import { TelegramService }         from '@app/services/telegram.service';
import { RewardEngineService }      from '@app/services/reward-engine.service';
import { BadgeAiService }           from '@app/services/badge-ai.service';
import { allocateNextOrderNumber }  from '@app/utils/order/allocate-order-number.util';
import { PlaceOrderDto }            from './dto';

const ORDER_ATTRIBUTES = [
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
const DETAIL_INCLUDES  = [
    {
        model: OrderDetails,
        attributes: ['id', 'unit_price', 'qty', 'line_note'],
        include: [
            {
                model: OrderDetailModifier,
                required: false,
                attributes: [
                    'id',
                    'modifier_option_id',
                    'group_name',
                    'option_label',
                    'price_delta_applied',
                ],
            },
            {
                model: Menu,
                attributes: ['id', 'name', 'code', 'image'],
                include: [{ model: MenuType, attributes: ['name'] }],
            },
        ],
    },
];

@Injectable()
export class CustomerOrderService {
    private readonly logger = new Logger(CustomerOrderService.name);

    constructor(
        @InjectConnection() private readonly _sequelize: Sequelize,
        private readonly _telegram : TelegramService,
        private readonly _reward   : RewardEngineService,
        private readonly _badgeAi  : BadgeAiService,
    ) {}

    /** Active coupons for customer checkout (same rules as cashier). */
    async listActiveCoupons(): Promise<{ data: { id: number; code: string; discount_percent: number }[] }> {
        const rows = await Coupon.findAll({
            where: { is_active: true },
            attributes: ['id', 'code', 'discount_percent'],
            order: [['code', 'ASC']],
        });
        return {
            data: rows.map((c) => ({
                id: c.id,
                code: c.code,
                discount_percent: Number(c.discount_percent),
            })),
        };
    }

    /** Menu catalog (types + menus) — same query as cashier `OrderService.getMenus`. */
    async getMenus(): Promise<{ data: { id: number; name: string; menus: Menu[] }[] }> {
        const data = await MenuType.findAll({
            attributes: ['id', 'name'],
            include: [
                {
                    model: Menu,
                    attributes: ['id', 'type_id', 'name', 'image', 'unit_price', 'code'],
                    include: [
                        {
                            model: MenuType,
                            attributes: ['name'],
                        },
                        getMenuCatalogInclude(),
                    ],
                },
            ],
            order: [['name', 'ASC']],
        });

        const dataFormat: { id: number; name: string; menus: Menu[] }[] = data.map((type) => ({
            id: type.id,
            name: type.name,
            menus: (type.menus || []).map((m) => toPlainMenuWithSortedModifiers(m) as unknown as Menu),
        }));

        return { data: dataFormat };
    }

    // =============================================>> Place a new order (telegram / website)
    async placeOrder(customerId: number, body: PlaceOrderDto): Promise<{ data: Order; message: string }> {
        let transaction: Transaction;

        try {
            transaction = await this._sequelize.transaction();

            const order = await Order.create({
                customer_id    : customerId,
                channel        : body.channel,
                status         : OrderStatusEnum.PENDING,
                total_price    : 0,
                receipt_number : await this._generateReceiptNumber(),
                order_number   : await allocateNextOrderNumber(transaction),
                ordered_at     : null,
            }, { transaction });

            let totalPrice  = 0;
            const cartItems = normalizeCartLines(body.cart);

            for (const item of cartItems) {
                const menu = await Menu.findByPk(item.menuId);
                if (!menu) {
                    throw new BadRequestException(
                        `Menu #${item.menuId} is not in the catalog. Check cart and try again.`,
                    );
                }

                const { unitPrice, snapshots, selectedOptions } = await buildLineModifiers(
                    menu,
                    item.modifier_option_ids,
                    transaction,
                );

                const detail = await OrderDetails.create(
                    {
                        order_id: order.id,
                        menu_id: menu.id,
                        qty: item.qty,
                        unit_price: unitPrice,
                        line_note: item.line_note,
                    },
                    { transaction },
                );

                await createDetailModifiers(detail.id, snapshots, transaction);

                totalPrice += item.qty * unitPrice;

                await deductStockForMenuRecipeLines(
                    menu,
                    item.qty,
                    transaction,
                    { receiptRef: order.receipt_number + '', createdBy: null },
                );
                await deductStockForModifierOptionRecipes(
                    menu,
                    selectedOptions,
                    item.qty,
                    transaction,
                    { receiptRef: order.receipt_number + '', createdBy: null },
                );
            }

            const subtotalBeforeDiscount = totalPrice;
            let couponId: number | null = null;
            let couponCodeSnapshot: string | null = null;
            let discountPercentApplied: number | null = null;
            let discountAmount = 0;

            const rawCoupon = body.coupon_code?.trim();
            if (rawCoupon) {
                const normalized = rawCoupon.trim().toUpperCase();
                const coupon = await Coupon.findOne({
                    where: { code: normalized, is_active: true },
                    transaction,
                });
                if (!coupon) {
                    throw new BadRequestException('Invalid or inactive coupon code.');
                }
                const pct = Number(coupon.discount_percent);
                if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
                    throw new BadRequestException('Coupon is misconfigured.');
                }
                discountAmount = Math.round((subtotalBeforeDiscount * pct) / 100);
                if (discountAmount > subtotalBeforeDiscount) {
                    discountAmount = subtotalBeforeDiscount;
                }
                couponId = coupon.id;
                couponCodeSnapshot = coupon.code;
                discountPercentApplied = pct;
            }

            const finalTotal = Math.max(0, subtotalBeforeDiscount - discountAmount);

            const couponPatch = rawCoupon
                ? {
                      coupon_id: couponId,
                      coupon_code: couponCodeSnapshot,
                      discount_percent: discountPercentApplied,
                      discount_amount: discountAmount > 0 ? discountAmount : null,
                  }
                : {
                      coupon_id: null,
                      coupon_code: null,
                      discount_percent: null,
                      discount_amount: null,
                  };

            await Order.update(
                {
                    total_price: finalTotal,
                    ordered_at: new Date(),
                    ...couponPatch,
                },
                { where: { id: order.id }, transaction },
            );

            const data = await Order.findByPk(order.id, {
                attributes : ORDER_ATTRIBUTES,
                include    : DETAIL_INCLUDES,
                transaction,
            });

            await transaction.commit();

            // ── Earn reward points on net spend (post-coupon) ──────────────────────
            if (finalTotal > 0) {
                const receiptRef = data?.receipt_number ?? order.receipt_number;
                this._reward.earn(customerId, finalTotal, receiptRef).then(async (earnResult) => {
                    if (earnResult.rankedUp) {
                        const customer = await User.findByPk(customerId, { attributes: ['id', 'name', 'telegram_user_id'] });
                        // Auto-assign new badge via LLM (fire-and-forget)
                        this._badgeAi.decideBadgeForRankUp({
                            customerName : customer?.name ?? 'Customer',
                            totalEarned  : earnResult.newTier * 1000, // approximate — real total is in DB
                            newRankLabel : earnResult.newRankLabel,
                            badgeAnswers : earnResult.badgeAnswers,
                            rewardPointId: earnResult.rewardPointId,
                        });
                        // Notify customer of rank-up via Telegram
                        const chatId = customer?.telegram_user_id;
                        if (chatId) {
                            this._telegram.sendHTMLToChat(
                                chatId,
                                `🏆 <b>You ranked up!</b>\nYou are now a <b>${earnResult.newRankLabel}</b>. Keep brewing! ☕`,
                            ).catch(() => {});
                        }
                    }
                }).catch(() => {});
            }

            // Telegram customer push (optional)
            try {
                if (
                    body.channel === OrderChannelEnum.TELEGRAM
                    || body.channel === OrderChannelEnum.WEBSITE
                ) {
                    const customer = await User.findByPk(customerId, { attributes: ['id', 'telegram_user_id', 'name'] });
                    const chatId = customer?.telegram_user_id;
                    if (chatId) {
                        await this._telegram.sendHTMLToChat(
                            chatId,
                            `✅ <b>Order placed</b>\nReceipt: <code>#${data?.receipt_number ?? order.receipt_number}</code>\nStatus: <b>${data?.status ?? OrderStatusEnum.PENDING}</b>`,
                        );
                    }
                }
            } catch {
                // optional channel
            }
            return { data, message: 'Your order has been placed successfully.' };

        } catch (error) {
            if (transaction) await transaction.rollback();
            if (error instanceof HttpException) {
                throw error;
            }
            this.logger.error('placeOrder unexpected error', error);
            throw new BadRequestException('Something went wrong! Please try again later.');
        } finally {}
    }

    // =============================================>> List my orders (history)
    async getMyOrders(
        customerId : number,
        page       : number = 1,
        limit      : number = 10,
    ) {
        const offset = (page - 1) * limit;

        const { rows, count } = await Order.findAndCountAll({
            attributes : ORDER_ATTRIBUTES,
            include    : DETAIL_INCLUDES,
            where      : { customer_id: customerId },
            order      : [['ordered_at', 'DESC']],
            limit,
            offset,
            distinct   : true,
        });

        return {
            data: rows,
            pagination: {
                page,
                limit,
                totalPage : Math.ceil(count / limit),
                total     : count,
            },
        };
    }

    // =============================================>> Track a single order
    async trackOrder(id: number, customerId: number) {
        const data = await Order.findOne({
            attributes : [...ORDER_ATTRIBUTES, 'created_at'],
            include    : DETAIL_INCLUDES,
            where      : { id, customer_id: customerId },
        });

        if (!data) {
            throw new NotFoundException(`Order #${id} not found.`);
        }

        return { data };
    }

    private async _generateReceiptNumber(): Promise<string> {
        const number = Math.floor(Math.random() * 9000000) + 1000000;
        const exists = await Order.findOne({ where: { receipt_number: number + '' } });
        if (exists) return this._generateReceiptNumber();
        return number + '';
    }
}
