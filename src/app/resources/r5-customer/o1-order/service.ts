// =========================================================================>> Core Library
import { BadRequestException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';

// =========================================================================>> Third Party Library
import { Op, Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

// =========================================================================>> Custom Library
import { OrderStatusEnum }  from '@app/enums/order-status.enum';
import { OrderChannelEnum } from '@app/enums/order-channel.enum';
import OrderDetails         from '@app/models/order/detail.model';
import Order                from '@app/models/order/order.model';
import Menu              from '@app/models/menu/menu.model';
import MenuType          from '@app/models/menu/menu-type.model';
import MenuSize          from '@app/models/menu/menu-size.model';
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
import CouponAssignedUser   from '@app/models/coupon/coupon_assigned_user.model';
import CouponMenu           from '@app/models/coupon/coupon_menu.model';
import CouponCategory       from '@app/models/coupon/coupon_category.model';
import CouponUsage          from '@app/models/coupon/coupon_usage.model';
import User                 from '@app/models/user/user.model';
import PaymentTransaction, { PaymentStatus } from '@app/models/payment/payment_transaction.model';
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

    /** Active coupons for customer checkout. Filters by expiry, usage limit, user assignment, and already-used. */
    async listActiveCoupons(customerId: number): Promise<{ data: { id: number; code: string; discount_percent: number; expires_at: Date | null }[] }> {
        const now = new Date();

        // Coupons this customer already used
        const usedCouponIds = (await CouponUsage.findAll({
            where: { user_id: customerId },
            attributes: ['coupon_id'],
        })).map((u) => u.coupon_id);

        // Coupon IDs assigned to any user at all
        const allAssignedIds = (await CouponAssignedUser.findAll({
            attributes: ['coupon_id'],
            group: ['coupon_id'],
        })).map((a) => a.coupon_id);

        // Coupon IDs assigned specifically to this customer
        const assignedToMeIds = (await CouponAssignedUser.findAll({
            where: { user_id: customerId },
            attributes: ['coupon_id'],
        })).map((a) => a.coupon_id);

        // Coupons restricted to other users (assigned but not to this customer)
        const restrictedToOthers = allAssignedIds.filter((id) => !assignedToMeIds.includes(id));

        const excludeIds = [...new Set([...usedCouponIds, ...restrictedToOthers])];

        const rows = await Coupon.findAll({
            where: {
                is_active: true,
                [Op.and]: [
                    { [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: now } }] },
                    { [Op.or]: [{ usage_limit: null }, Coupon.sequelize!.literal('usage_count < usage_limit')] },
                    ...(excludeIds.length > 0 ? [{ id: { [Op.notIn]: excludeIds } }] : []),
                ],
            },
            attributes: ['id', 'code', 'discount_percent', 'expires_at'],
            order: [['code', 'ASC']],
        });
        return {
            data: rows.map((c) => ({
                id: c.id,
                code: c.code,
                discount_percent: Number(c.discount_percent),
                expires_at: c.expires_at,
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
                    attributes: ['id', 'type_id', 'name', 'image', 'unit_price', 'has_sizes', 'code'],
                    include: [
                        {
                            model: MenuType,
                            attributes: ['name'],
                        },
                        {
                            // Sized items keep their per-size prices on the `menu_sizes` table; the customer storefront
                            // needs these to render the right price (and let the customer pick S/M/L).
                            model: MenuSize,
                            as: 'sizes',
                            attributes: ['id', 'size', 'price'],
                            required: false,
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

            // Customer-placed orders (web + Telegram Mini App) must be paid before reaching the
            // kitchen queue. Start in AWAITING_PAYMENT so the Bakong intent flow can promote
            // the order to PENDING once the KHQR is settled. Walk-in / cashier orders go through
            // a different controller and keep their own lifecycle.
            const order = await Order.create({
                customer_id    : customerId,
                channel        : body.channel,
                status         : OrderStatusEnum.AWAITING_PAYMENT,
                total_price    : 0,
                receipt_number : await this._generateReceiptNumber(),
                order_number   : await allocateNextOrderNumber(transaction),
                ordered_at     : null,
            }, { transaction });

            let totalPrice  = 0;
            const cartItems = normalizeCartLines(body.cart);
            const cartLineDetails: { menuId: number; typeId: number; lineTotal: number }[] = [];

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
                    item.size,
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

                const lineTotal = item.qty * unitPrice;
                totalPrice += lineTotal;
                cartLineDetails.push({ menuId: menu.id, typeId: menu.type_id, lineTotal });

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
                if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
                    throw new BadRequestException('This coupon has expired.');
                }
                if (coupon.usage_limit != null && coupon.usage_count >= coupon.usage_limit) {
                    throw new BadRequestException('This coupon has reached its usage limit.');
                }
                const assignments = await CouponAssignedUser.findAll({
                    where: { coupon_id: coupon.id },
                    attributes: ['user_id'],
                    transaction,
                });
                if (assignments.length > 0 && !assignments.some((a) => a.user_id === customerId)) {
                    throw new BadRequestException('This coupon is not available for your account.');
                }
                const alreadyUsed = await CouponUsage.findOne({
                    where: { coupon_id: coupon.id, user_id: customerId },
                    transaction,
                });
                if (alreadyUsed) {
                    throw new BadRequestException('You have already used this coupon.');
                }
                const pct = Number(coupon.discount_percent);
                if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
                    throw new BadRequestException('Coupon is misconfigured.');
                }

                const [menuRestrictions, categoryRestrictions] = await Promise.all([
                    CouponMenu.findAll({ where: { coupon_id: coupon.id }, attributes: ['menu_id'], transaction }),
                    CouponCategory.findAll({ where: { coupon_id: coupon.id }, attributes: ['category_id'], transaction }),
                ]);
                const allowedMenuIds = menuRestrictions.map((r) => r.menu_id);
                const allowedCategoryIds = categoryRestrictions.map((r) => r.category_id);
                const hasRestrictions = allowedMenuIds.length > 0 || allowedCategoryIds.length > 0;

                let eligibleSubtotal = subtotalBeforeDiscount;
                if (hasRestrictions) {
                    eligibleSubtotal = cartLineDetails
                        .filter((l) => allowedMenuIds.includes(l.menuId) || allowedCategoryIds.includes(l.typeId))
                        .reduce((sum, l) => sum + l.lineTotal, 0);
                    if (eligibleSubtotal === 0) {
                        throw new BadRequestException('This coupon cannot be applied to the items in your cart.');
                    }
                }

                discountAmount = Math.round((eligibleSubtotal * pct) / 100);
                if (discountAmount > subtotalBeforeDiscount) discountAmount = subtotalBeforeDiscount;
                couponId = coupon.id;
                couponCodeSnapshot = coupon.code;
                discountPercentApplied = pct;
                await Coupon.increment('usage_count', { by: 1, where: { id: coupon.id }, transaction });
                await CouponUsage.create({ coupon_id: coupon.id, user_id: customerId }, { transaction });
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
                            `🧾 <b>Order received</b>\nReceipt: <code>#${data?.receipt_number ?? order.receipt_number}</code>\nStatus: <b>${data?.status ?? OrderStatusEnum.AWAITING_PAYMENT}</b>\n\nScan the KHQR in the app to confirm your order.`,
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

        const orderIds = rows.map((o) => o.id);
        const paidSet  = await this._getPaidOrderIds(orderIds);

        return {
            data: rows.map((o) => ({ ...o.toJSON(), is_paid: paidSet.has(o.id) })),
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

        const paidSet = await this._getPaidOrderIds([id]);
        return { data: { ...data.toJSON(), is_paid: paidSet.has(id) } };
    }

    private async _getPaidOrderIds(orderIds: number[]): Promise<Set<number>> {
        if (orderIds.length === 0) return new Set();
        const txs = await PaymentTransaction.findAll({
            attributes: ['order_id'],
            where: { order_id: orderIds, status: PaymentStatus.SUCCESS },
        });
        return new Set(txs.map((t) => t.order_id));
    }

    private async _generateReceiptNumber(): Promise<string> {
        const number = Math.floor(Math.random() * 9000000) + 1000000;
        const exists = await Order.findOne({ where: { receipt_number: number + '' } });
        if (exists) return this._generateReceiptNumber();
        return number + '';
    }
}
