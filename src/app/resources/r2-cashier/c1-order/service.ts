// =========================================================================>> Core Library
import { BadRequestException, Injectable } from '@nestjs/common';

// =========================================================================>> Third Party Library
import { Sequelize, Transaction } from 'sequelize';

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

        const dataFormat: { id: number, name: string, menus: Menu[] }[] = data.map((type) => ({
            id: type.id,
            name: type.name,
            menus: (type.menus || []).map((m) => toPlainMenuWithSortedModifiers(m) as unknown as Menu),
        }));

        return { data: dataFormat };
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
                ordered_at   : null,
            }, { transaction });

            // Find Total Price & Order Details
            let totalPrice = 0;
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
                    { receiptRef: order.receipt_number + '', createdBy: cashierId },
                );
                await deductStockForModifierOptionRecipes(
                    menu,
                    selectedOptions,
                    item.qty,
                    transaction,
                    { receiptRef: order.receipt_number + '', createdBy: cashierId },
                );
            }

            // Update Order with total price and ordered_at timestamp
            await Order.update({
                total_price: totalPrice,
                ordered_at: new Date(),
            }, {
                where: { id: order.id },
                transaction,
            });

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
                attributes: ['id', 'receipt_number', 'total_price', 'channel', 'status', 'ordered_at'],
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
                ],
                transaction, // Ensure this is inside the same transaction
            });

            // Commit transaction after successful operations
            await transaction.commit();

            if (!body.deferred_telegram) {
                await this._sendPlacedOrderTelegramAndSocket(data, body.channel);
            }
            return {
                data,
                message: body.deferred_telegram
                    ? "Order saved — please complete Baray payment."
                    : "Order created successfully.",
            };

        } catch (error) {
            if (transaction) {
                await transaction.rollback(); // Rollback transaction on error
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
                { model: Order, attributes: ["id", "receipt_number", "total_price", "ordered_at"] },
                { model: User, attributes: ["id", "avatar", "name"] },
            ],
            order: [["id", "DESC"]],
        });
        const dataNotifications = notifications.map((n) => ({
            id: n.id,
            receipt_number: n.order.receipt_number,
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
            attributes: ["id", "receipt_number", "total_price", "channel", "status", "ordered_at"],
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
            attributes: ["id", "receipt_number", "total_price", "channel", "status", "ordered_at"],
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
