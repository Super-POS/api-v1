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
import { deductStockForMenuRecipeLines } from '@app/utils/menu-recipe-stock.util';
import MenuType from '@app/models/menu/menu-type.model';
import { CreateOrderDto } from './dto';

// ======================================= >> Code Starts Here << ========================== //
@Injectable()
export class OrderService {

    constructor(private telegramService: TelegramService,
        private readonly notificationsGateway: NotificationsGateway,
    ) { };

    private _normalizeCartItems(rawCart: unknown): Array<{ menuId: number; qty: number }> {
        const parsed = typeof rawCart === 'string' ? JSON.parse(rawCart) : rawCart;

        if (Array.isArray(parsed)) {
            return parsed
                .map((item: any) => ({
                    menuId: Number(
                        item?.menu_id ?? (item as { product_id?: number })?.product_id ?? item?.id,
                    ),
                    qty: Number(item?.quantity ?? item?.qty ?? 0),
                }))
                .filter((item) => Number.isFinite(item.menuId) && item.menuId > 0 && Number.isFinite(item.qty) && item.qty > 0);
        }

        if (parsed && typeof parsed === 'object') {
            return Object.entries(parsed as Record<string, unknown>)
                .map(([id, value]) => {
                    if (value && typeof value === 'object') {
                        const v: any = value;
                        return {
                            menuId: Number(
                                v.menu_id ?? (v as { product_id?: number }).product_id ?? id,
                            ),
                            qty: Number(v.quantity ?? v.qty ?? 0),
                        };
                    }
                    return {
                        menuId: Number(id),
                        qty: Number(value),
                    };
                })
                .filter((item) => Number.isFinite(item.menuId) && item.menuId > 0 && Number.isFinite(item.qty) && item.qty > 0);
        }

        return [];
    }

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
                    ],
                },
            ],
            order: [['name', 'ASC']],
        });

        const dataFormat: { id: number, name: string, menus: Menu[] }[] = data.map((type) => ({
            id: type.id,
            name: type.name,
            menus: type.menus || [],
        }));

        return { data: dataFormat };
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
            const cartItems = this._normalizeCartItems(body.cart);

            // Loop through cart items and calculate total price
            for (const item of cartItems) {
                const menu = await Menu.findByPk(item.menuId);

                if (menu) {
                    // Save to Order Details
                    await OrderDetails.create({
                        order_id: order.id,
                        menu_id: menu.id,
                        qty: item.qty,
                        unit_price: menu.unit_price,
                    }, { transaction });

                    totalPrice += item.qty * menu.unit_price; // Add to total price

                    await deductStockForMenuRecipeLines(
                        menu,
                        item.qty,
                        transaction,
                        { receiptRef: order.receipt_number + '', createdBy: cashierId },
                    );
                }
            }

            // Update Order with total price and ordered_at timestamp
            await Order.update({
                total_price: totalPrice,
                ordered_at: new Date(),
            }, {
                where: { id: order.id },
                transaction,
            });

            // Create notification for this order
            await Notifications.create({
                order_id: order.id,
                user_id: cashierId,
                read: false,
            }, { transaction });

            // Get order details for client response
            const data: Order = await Order.findByPk(order.id, {
                attributes: ['id', 'receipt_number', 'total_price', 'channel', 'status', 'ordered_at'],
                include: [
                    {
                        model: OrderDetails,
                        attributes: ['id', 'unit_price', 'qty'],
                        include: [
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
            const currentDateTime = await this.getCurrentDateTimeInCambodia();
            let htmlMessage = `<b>ការបញ្ជាទិញទទួលបានជោគជ័យ!</b>\n`;
            htmlMessage += `-លេខវិកយប័ត្រ`;
            htmlMessage += `\u2003៖ ${data.receipt_number}\n`;
            htmlMessage += `-តម្លៃសរុប​​​​`;
            htmlMessage += `\u2003\u2003\u2003៖ ${this.formatPrice(data.total_price)} ៛\n`;
            htmlMessage += `-អ្នកគិតលុយ`;
            htmlMessage += `\u2003\u2003 ៖ ${data.cashier?.name || ''}\n`;
            htmlMessage += `-តាមរយះ`;
            htmlMessage += `\u2003\u2003\u2003 ៖ ${body.channel || ''}\n`;
            htmlMessage += `-កាលបរិច្ឆេទ\u2003\u2003៖ ${currentDateTime}\n`;

            // Send
            await this.telegramService.sendHTMLMessage(htmlMessage);

            const notifications = await Notifications.findAll({
                attributes: ['id', 'read'],
                include: [
                    {
                        model: Order,
                        attributes: ['id', 'receipt_number', 'total_price', 'ordered_at'],
                    },
                    {
                        model: User,
                        attributes: ['id', 'avatar', 'name'],
                    },

                ],
                order: [['id', 'DESC']],
            });
            const dataNotifications = notifications.map(notification => ({
                id: notification.id,
                receipt_number: notification.order.receipt_number,
                total_price: notification.order.total_price,
                ordered_at: notification.order.ordered_at,
                cashier: {
                    id: notification.user.id,
                    name: notification.user.name,
                    avatar: notification.user.avatar
                },
                read: notification.read
            }));
            this.notificationsGateway.sendOrderNotification({ data: dataNotifications });
            return { data, message: 'ការបញ្ជាទិញត្រូវបានបង្កើតដោយជោគជ័យ។' };

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

    private formatPrice(price: number): string {
        return new Intl.NumberFormat('en-US', {
            style: 'decimal',
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
