// =========================================================================>> Core Library
import { BadRequestException, HttpException, Injectable } from '@nestjs/common';

// =========================================================================>> Third Party Library
import { Op, Sequelize, Transaction } from 'sequelize';

// =========================================================================>> Custom Library
import { OrderStatusEnum }  from '@app/enums/order-status.enum';
import { NotificationsGateway } from '@app/utils/notification-getway/notifications.gateway';
import Notifications from '@app/models/notification/notification.model';
import User from '@app/models/user/user.model';
import { TelegramService } from 'src/app/services/telegram.service';
import sequelizeConfig from 'src/config/sequelize.config';
import OrderDetails from 'src/app/models/order/detail.model';
import Order from 'src/app/models/order/order.model';
import Menu from '@app/models/menu/menu.model';
import MenuIngredient from '@app/models/menu/menu-ingredient.model';
import { deductStockForMenuRecipeLines, deductStockForModifierOptionRecipes } from '@app/utils/menu-recipe-stock.util';
import OrderDetailModifier from '@app/models/order/order-detail-modifier.model';
import {
    buildLineModifiers,
    createDetailModifiers,
    getMenuCatalogInclude,
    normalizeCartLines,
    toPlainMenuWithSortedModifiers,
} from '@app/utils/modifier-order.util';
import MenuType from '@app/models/menu/menu-type.model';
import MenuSize from '@app/models/menu/menu-size.model';
import Coupon from '@app/models/coupon/coupon.model';
import CouponAssignedUser from '@app/models/coupon/coupon_assigned_user.model';
import CouponMenu from '@app/models/coupon/coupon_menu.model';
import CouponCategory from '@app/models/coupon/coupon_category.model';
import { allocateNextOrderNumber } from '@app/utils/order/allocate-order-number.util';
import { CreateOrderDto } from './dto';

// ======================================= >> Code Starts Here << ========================== //
@Injectable()
export class OrderService {

    constructor(private telegramService: TelegramService,
        private readonly notificationsGateway: NotificationsGateway,
    ) { };

    async getMenus(): Promise<{ data: { id: number, name: string, menus: Menu[] }[] }> {
        const data = await MenuType.findAll({
            attributes: ['id', 'name'],
            include: [
                {
                    model: Menu,
                    attributes: ['id', 'type_id', 'name', 'image', 'unit_price', 'has_sizes', 'code', 'is_available'],
                    where: { is_available: true },
                    required: false,
                    include: [
                        {
                            model: MenuType,
                            attributes: ['name'],
                        },
                        {
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

        const dataFormat: { id: number, name: string, menus: Menu[] }[] = data.map((type) => ({
            id: type.id,
            name: type.name,
            menus: (type.menus || []).map((m) => toPlainMenuWithSortedModifiers(m) as unknown as Menu),
        }));

        return { data: dataFormat };
    }

    /** Active coupons for cashier checkout. Excludes expired and exhausted coupons. */
    async listActiveCoupons(): Promise<{ data: { id: number; code: string; discount_percent: number; expires_at: Date | null; usage_limit: number | null; usage_count: number; user_restricted: boolean }[] }> {
        const now = new Date();
        const rows = await Coupon.findAll({
            where: {
                is_active: true,
                [Op.and]: [
                    { [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: now } }] },
                    { [Op.or]: [{ usage_limit: null }, Coupon.sequelize!.literal('usage_count < usage_limit')] },
                ],
            },
            attributes: ['id', 'code', 'discount_percent', 'expires_at', 'usage_limit', 'usage_count'],
            include: [{ model: CouponAssignedUser, as: 'assignments', attributes: ['user_id'], required: false }],
            order: [['code', 'ASC']],
        });
        return {
            data: rows.map((c) => ({
                id: c.id,
                code: c.code,
                discount_percent: Number(c.discount_percent),
                expires_at: c.expires_at,
                usage_limit: c.usage_limit,
                usage_count: c.usage_count,
                user_restricted: (c.assignments?.length ?? 0) > 0,
            })),
        };
    }

    /** Cashier read-only view of ingredient stock so they can monitor availability while taking orders. */
    async getIngredientsStock(): Promise<{
        data: { id: number; name: string; unit: string | null; quantity: number; low_stock_threshold: number }[];
    }> {
        const data = await MenuIngredient.findAll({
            attributes: ['id', 'name', 'unit', 'quantity', 'low_stock_threshold'],
            order: [['name', 'ASC']],
        });

        return {
            data: data.map((row) => ({
                id: row.id,
                name: row.name,
                unit: row.unit ?? null,
                quantity: Number(row.quantity ?? 0),
                low_stock_threshold: Number(row.low_stock_threshold ?? 1000),
            })),
        };
    }

    // Method for creating an order
    async makeOrder(cashierId: number, body: CreateOrderDto): Promise<{ data: Order, message: string }> {
        // Initializing DB Connection
        const sequelize = new Sequelize(sequelizeConfig);
        let transaction: Transaction;
        let committed = false;

        try {
            // Open DB Connection
            transaction = await sequelize.transaction();

            // Create an order using method create()
            const order = await Order.create({
                cashier_id   : cashierId,
                channel      : body.channel,
                status       : OrderStatusEnum.PENDING,
                total_price  : 0,
                receipt_number: await this._generateReceiptNumber(),
                order_number : await allocateNextOrderNumber(transaction),
                ordered_at   : null,
            }, { transaction });

            // Find Total Price & Order Details
            let totalPrice = 0;
            const cartItems = normalizeCartLines(body.cart);
            const cartLineDetails: { menuId: number; typeId: number; lineTotal: number }[] = [];

            for (const item of cartItems) {
                const menu = await Menu.findByPk(item.menuId);
                if (!menu) {
                    throw new BadRequestException(
                        `Menu #${item.menuId} is not in the catalog. Check cart and try again.`,
                    );
                }
                if (!menu.is_available) {
                    throw new BadRequestException(
                        `"${menu.name}" is currently unavailable and cannot be ordered.`,
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
                    { receiptRef: order.receipt_number + '', createdBy: cashierId },
                    item.size,
                );
                await deductStockForModifierOptionRecipes(
                    menu,
                    selectedOptions,
                    item.qty,
                    transaction,
                    { receiptRef: order.receipt_number + '', createdBy: cashierId },
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
                if (assignments.length > 0) {
                    const allowed = assignments.some((a) => a.user_id === body.customer_id);
                    if (!allowed) {
                        throw new BadRequestException('This coupon is assigned to specific customers only.');
                    }
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
                {
                    where: { id: order.id },
                    transaction,
                },
            );

            const skipEarlyNotify = body.deferred_telegram === true;
            if (!skipEarlyNotify) {
                await Notifications.create({
                    order_id: order.id,
                    user_id: cashierId,
                    read: false,
                }, { transaction });
            }

            // Get order details for client response
            const data: Order = await Order.findByPk(order.id, {
                attributes: [
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
                ],
                include: [
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
                                include: [
                                    {
                                        model: MenuType,
                                        attributes: ['name'],
                                    }
                                ]
                            },
                        ],
                    },
                    {
                        model: User,
                        as: 'cashier',
                        attributes: ['id', 'avatar', 'name'],
                    },
                    {
                        model: User,
                        as: 'customer',
                        attributes: ['id', 'name', 'telegram_first_name', 'telegram_last_name', 'telegram_username'],
                        required: false,
                    },
                ],
                transaction, // Ensure this is inside the same transaction
            });

            // Commit transaction after successful operations
            await transaction.commit();
            committed = true;

            // Fire-and-forget: notification failures must never affect the saved order or the client response
            if (!body.deferred_telegram) {
                this._sendPlacedOrderTelegramAndSocket(data, body.channel).catch((e) =>
                    console.error('Post-commit notification error (order was saved):', e),
                );
            }
            return {
                data,
                message: body.deferred_telegram
                    ? "Order saved — please complete Baray payment."
                    : "Order created successfully.",
            };

        } catch (error) {
            if (transaction && !committed) {
                await transaction.rollback();
            }
            if (error instanceof HttpException) {
                throw error;
            }
            console.error('Error during order creation:', error);
            throw new BadRequestException('Something went wrong! Please try again later.', 'Error during order creation.');
        } finally {
            // Close DB connection if necessary
            await sequelize.close(); // Close sequelize connection
        }
    }

    private async _sendPlacedOrderTelegramAndSocket(
        data: Order,
        channel: Order["channel"] | string,
        paymentInfo?: { paidBy?: string; paidAmount?: number },
    ): Promise<void> {
        const currentDateTime = await this.getCurrentDateTimeInCambodia();
        let htmlMessage = `<b>Order placed successfully!</b>\n`;
        htmlMessage += `<b>Status: Success</b>\n`;
        htmlMessage += `-Receipt`;
        htmlMessage += `\u2003: ${data.receipt_number}\n`;
        if (data.order_number != null && Number.isFinite(Number(data.order_number))) {
            htmlMessage += `-Order no`;
            htmlMessage += `\u2003: ${String(Math.floor(Number(data.order_number))).padStart(3, '0')}\n`;
        }
        const disc = Number(data.discount_amount ?? 0);
        if (disc > 0 && data.coupon_code) {
            const sub = (Number(data.total_price ?? 0) + disc);
            htmlMessage += `-Subtotal`;
            htmlMessage += `\u2003: ${this.formatPrice(sub)} KHR\n`;
            htmlMessage += `-Discount (${data.coupon_code}, ${data.discount_percent}%)`;
            htmlMessage += `\u2003: -${this.formatPrice(disc)} KHR\n`;
        }
        htmlMessage += `-Total`;
        htmlMessage += `\u2003\u2003\u2003: ${this.formatPrice(data.total_price!)} KHR\n`;
        htmlMessage += `-Cashier`;
        htmlMessage += `\u2003\u2003 : ${data.cashier?.name || ""}\n`;
        htmlMessage += `-Channel`;
        htmlMessage += `\u2003\u2003\u2003 : ${String(channel || "")}\n`;
        if (paymentInfo?.paidBy?.trim()) {
            htmlMessage += `-Paid by`;
            htmlMessage += `\u2003: ${paymentInfo.paidBy.trim()}\n`;
        }
        if (typeof paymentInfo?.paidAmount === "number" && Number.isFinite(paymentInfo.paidAmount)) {
            htmlMessage += `-Amount paid`;
            htmlMessage += `\u2003: ${this.formatPrice(paymentInfo.paidAmount)} KHR\n`;
        }
        htmlMessage += `-Date\u2003\u2003: ${currentDateTime}\n`;
        await this.telegramService.sendHTMLMessage(htmlMessage);
        const notifications = await Notifications.findAll({
            attributes: ["id", "read"],
            include: [
                { model: Order, attributes: ["id", "receipt_number", "order_number", "total_price", "ordered_at"] },
                { model: User, attributes: ["id", "avatar", "name"] },
            ],
            order: [["id", "DESC"]],
        });
        const dataNotifications = notifications
            .filter((n) => n.order != null && n.user != null)
            .map((n) => ({
                id: n.id,
                receipt_number: n.order.receipt_number,
                order_number: n.order.order_number,
                total_price: n.order.total_price,
                ordered_at: n.order.ordered_at,
                cashier: { id: n.user.id, name: n.user.name, avatar: n.user.avatar },
                read: n.read,
            }));
        this.notificationsGateway.sendOrderNotification({ data: dataNotifications });
    }

    /**
     * Telegram: order was cancelled (kitchen / manage flow). Does not push socket list.
     */
    async sendOrderCancelledTelegram(orderId: number): Promise<void> {
        const data = await Order.findByPk(orderId, {
            attributes: ["id", "receipt_number", "order_number", "total_price", "channel", "status", "ordered_at"],
            include: [{ model: User, as: "cashier", attributes: ["id", "avatar", "name"] }],
        });
        if (!data) {
            return;
        }
        const currentDateTime = await this.getCurrentDateTimeInCambodia();
        let htmlMessage = `<b>Order cancelled</b>\n`;
        htmlMessage += `<b>Status: Cancel</b>\n`;
        htmlMessage += `-Receipt\u2003: ${data.receipt_number}\n`;
        htmlMessage += `-Total\u2003\u2003: ${this.formatPrice(data.total_price ?? 0)} KHR\n`;
        htmlMessage += `-Cashier\u2003: ${data.cashier?.name || ""}\n`;
        htmlMessage += `-Channel\u2003: ${String(data.channel || "")}\n`;
        htmlMessage += `-Date\u2003\u2003: ${currentDateTime}\n`;
        await this.telegramService.sendHTMLMessage(htmlMessage);
    }

    /**
     * Baray: after payment, send Telegram + socket list + create notification if we skipped at order create.
     */
    async sendPlacedNotificationsAfterBarayPayment(
        orderId: number,
        paymentInfo?: { paidBy?: string; paidAmount?: number },
    ): Promise<void> {
        if (await Notifications.findOne({ where: { order_id: orderId } })) {
            return;
        }
        const data = await Order.findByPk(orderId, {
            attributes: [
                "id",
                "receipt_number",
                "order_number",
                "total_price",
                "channel",
                "status",
                "ordered_at",
                "coupon_code",
                "discount_percent",
                "discount_amount",
            ],
            include: [
                {
                    model: OrderDetails,
                    attributes: ["id", "unit_price", "qty", "line_note"],
                    include: [
                        {
                            model: OrderDetailModifier,
                            required: false,
                            attributes: [
                                "id",
                                "modifier_option_id",
                                "group_name",
                                "option_label",
                                "price_delta_applied",
                            ],
                        },
                        {
                            model: Menu,
                            attributes: ["id", "name", "code", "image"],
                            include: [{ model: MenuType, attributes: ["name"] }],
                        },
                    ],
                },
                { model: User, as: "cashier", attributes: ["id", "avatar", "name"] },
                {
                    model: User,
                    as: "customer",
                    attributes: ["id", "name", "telegram_user_id", "telegram_first_name", "telegram_last_name", "telegram_username"],
                    required: false,
                },
            ],
        });
        if (!data) {
            return;
        }
        await Notifications.create({
            order_id: orderId,
            user_id: data.cashier_id!,
            read: false,
        });
        await this._sendPlacedOrderTelegramAndSocket(data, data.channel, paymentInfo);
    }

    private formatPrice(price: number): string {
        return new Intl.NumberFormat("en-US", {
            style: "decimal",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(price);
    }

    private async getCurrentDateTimeInCambodia(): Promise<string> {
        const now = new Date();

        // Options for Cambodia time zone with 12-hour format
        const options: Intl.DateTimeFormatOptions = {
            timeZone: 'Asia/Phnom_Penh',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true, // Use 12-hour format with AM/PM
        };

        const formatter = new Intl.DateTimeFormat('en-GB', options);
        const parts = formatter.formatToParts(now);

        // Extract date and time components
        const day = parts.find(p => p.type === 'day')?.value;
        const month = parts.find(p => p.type === 'month')?.value;
        const year = parts.find(p => p.type === 'year')?.value;
        const hour = parts.find(p => p.type === 'hour')?.value;
        const minute = parts.find(p => p.type === 'minute')?.value;
        const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value; // AM/PM

        // Short date format: dd/mm/yyyy hh:mm AM/PM
        return `${day}/${month}/${year} ${hour}:${minute} ${dayPeriod}`;
    }

    // Private method to generate a unique receipt number
    private async _generateReceiptNumber(): Promise<string> {

        const number = Math.floor(Math.random() * 9000000) + 1000000;

        return await Order.findOne({
            where: {
                receipt_number: number+'',
            },
        }).then((order) => {

            if (order) {
                return this._generateReceiptNumber() + '';
            }

            return number + '';
        });
    }
}
