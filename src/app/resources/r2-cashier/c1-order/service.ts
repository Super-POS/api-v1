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
import ProductIngredient from 'src/app/models/product/ingredient.model';
import Product from 'src/app/models/product/product.model';
import ProductRecipe from 'src/app/models/product/recipe.model';
import IngredientStockMovement, { StockMovementType } from 'src/app/models/product/stock_movement.model';
import ProductType from 'src/app/models/product/type.model';
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
                    menuId: Number(item?.menu_id ?? item?.product_id ?? item?.id),
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
                            menuId: Number(v.menu_id ?? v.product_id ?? id),
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

    async getProducts(): Promise<{ data: { id: number, name: string, products: Product[] }[] }> {
        const data = await ProductType.findAll({
            attributes: ['id', 'name'],
            include: [
                {
                    model: Product,
                    attributes: ['id', 'type_id', 'name', 'image', 'unit_price', 'code'],
                    include: [
                        {
                            model: ProductType,
                            attributes: ['name'],
                        },
                    ],
                },
            ],
            order: [['name', 'ASC']],
        });

        const dataFormat: { id: number, name: string, products: Product[] }[] = data.map(type => ({
            id: type.id,
            name: type.name,
            products: type.products || []
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
                const product = await Product.findByPk(item.menuId); // Find menu by its ID

                if (product) {
                    // Save to Order Details
                    await OrderDetails.create({
                        order_id: order.id,
                        product_id: product.id,
                        qty: item.qty,
                        unit_price: product.unit_price,
                    }, { transaction });

                    totalPrice += item.qty * product.unit_price; // Add to total price

                    // Deduct ingredient stock based on product recipe
                    const recipes = await ProductRecipe.findAll({
                        where: { product_id: product.id },
                        include: [{ model: ProductIngredient }],
                        transaction,
                    });

                    for (const recipe of recipes) {
                        const deduction = Number(recipe.quantity) * item.qty;
                        const currentQty = Number(recipe.ingredient.quantity);

                        if (currentQty < deduction) {
                            throw new BadRequestException(
                                `Insufficient stock for ingredient "${recipe.ingredient.name}". Available: ${currentQty}, required: ${deduction}.`
                            );
                        }

                        await IngredientStockMovement.create({
                            ingredient_id : recipe.ingredient_id,
                            type          : StockMovementType.OUT,
                            quantity      : deduction,
                            note          : `Order #${order.receipt_number}`,
                            created_by    : cashierId,
                        }, { transaction });

                        await ProductIngredient.update(
                            { quantity: currentQty - deduction },
                            { where: { id: recipe.ingredient_id }, transaction },
                        );
                    }
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
                                model: Product,
                                attributes: ['id', 'name', 'code', 'image'],
                                include: [
                                    {
                                        model: ProductType,
                                        attributes: ['name'],
                                    }
                                ]
                            },
                        ],
                    },
                    {
                        model: User,
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
