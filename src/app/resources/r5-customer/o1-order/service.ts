// =========================================================================>> Core Library
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

// =========================================================================>> Third Party Library
import { Sequelize, Transaction } from 'sequelize';

// =========================================================================>> Custom Library
import { OrderStatusEnum }  from '@app/enums/order-status.enum';
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
import User                 from '@app/models/user/user.model';
import sequelizeConfig      from 'src/config/sequelize.config';
import { PlaceOrderDto }    from './dto';

const ORDER_ATTRIBUTES = ['id', 'receipt_number', 'total_price', 'channel', 'status', 'ordered_at'];
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
