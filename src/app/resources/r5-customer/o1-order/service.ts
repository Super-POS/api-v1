// =========================================================================>> Core Library
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

// =========================================================================>> Third Party Library
import { Sequelize, Transaction } from 'sequelize';

// =========================================================================>> Custom Library
import { OrderStatusEnum }  from '@app/enums/order-status.enum';
import OrderDetails         from '@app/models/order/detail.model';
import Order                from '@app/models/order/order.model';
import Product              from '@app/models/product/product.model';
import ProductType          from '@app/models/product/type.model';
import User                 from '@app/models/user/user.model';
import sequelizeConfig      from 'src/config/sequelize.config';
import { PlaceOrderDto }    from './dto';

const ORDER_ATTRIBUTES = ['id', 'receipt_number', 'total_price', 'channel', 'status', 'ordered_at'];
const DETAIL_INCLUDES  = [
    {
        model: OrderDetails,
        attributes: ['id', 'unit_price', 'qty'],
        include: [
            {
                model: Product,
                attributes: ['id', 'name', 'code', 'image'],
                include: [{ model: ProductType, attributes: ['name'] }],
            },
        ],
    },
];

@Injectable()
export class CustomerOrderService {

    // =============================================>> Place a new order (telegram / website)
    async placeOrder(customerId: number, body: PlaceOrderDto): Promise<{ data: Order; message: string }> {
        const sequelize = new Sequelize(sequelizeConfig);
        let transaction: Transaction;

        try {
            transaction = await sequelize.transaction();

            const order = await Order.create({
                customer_id    : customerId,
                channel        : body.channel,
                status         : OrderStatusEnum.PENDING,
                total_price    : 0,
                receipt_number : await this._generateReceiptNumber(),
                ordered_at     : null,
            }, { transaction });

            let totalPrice  = 0;
            const cartItems = JSON.parse(body.cart);

            for (const [productId, qty] of Object.entries(cartItems)) {
                const product = await Product.findByPk(parseInt(productId));
                if (product) {
                    await OrderDetails.create({
                        order_id   : order.id,
                        product_id : product.id,
                        qty        : Number(qty),
                        unit_price : product.unit_price,
                    }, { transaction });

                    totalPrice += Number(qty) * product.unit_price;
                }
            }

            await Order.update(
                { total_price: totalPrice, ordered_at: new Date() },
                { where: { id: order.id }, transaction },
            );

            const data = await Order.findByPk(order.id, {
                attributes : ORDER_ATTRIBUTES,
                include    : DETAIL_INCLUDES,
                transaction,
            });

            await transaction.commit();
            return { data, message: 'Your order has been placed successfully.' };

        } catch (error) {
            if (transaction) await transaction.rollback();
            throw new BadRequestException('Something went wrong! Please try again later.');
        } finally {
            await sequelize.close();
        }
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
