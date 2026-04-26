// =========================================================================>> Core Library
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

// =========================================================================>> Third Party Library
import { Sequelize, Transaction } from 'sequelize';

// =========================================================================>> Custom Library
import { OrderStatusEnum }  from '@app/enums/order-status.enum';
import OrderDetails         from '@app/models/order/detail.model';
import Order                from '@app/models/order/order.model';
import ProductIngredient    from '@app/models/product/ingredient.model';
import Product              from '@app/models/product/product.model';
import ProductRecipe        from '@app/models/product/recipe.model';
import IngredientStockMovement, { StockMovementType } from '@app/models/product/stock_movement.model';
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
            const cartItems = this._normalizeCartItems(body.cart);

            for (const item of cartItems) {
                const product = await Product.findByPk(item.menuId);
                if (product) {
                    await OrderDetails.create({
                        order_id   : order.id,
                        product_id : product.id,
                        qty        : item.qty,
                        unit_price : product.unit_price,
                    }, { transaction });

                    totalPrice += item.qty * product.unit_price;

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
                            created_by    : null,
                        }, { transaction });

                        await ProductIngredient.update(
                            { quantity: currentQty - deduction },
                            { where: { id: recipe.ingredient_id }, transaction },
                        );
                    }
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
