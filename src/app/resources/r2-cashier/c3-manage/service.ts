// =========================================================================>> Core Library
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

// =========================================================================>> Third Party Library
import { Op } from 'sequelize';

// =========================================================================>> Custom Library
import { OrderStatusEnum }  from '@app/enums/order-status.enum';
import OrderDetails         from '@app/models/order/detail.model';
import Order                from '@app/models/order/order.model';
import Menu              from '@app/models/menu/menu.model';
import MenuType          from '@app/models/menu/menu-type.model';
import User                 from '@app/models/user/user.model';

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

    async getOrders(status?: OrderStatusEnum) {
        const where: any = {};
        if (status) {
            where.status = status;
        } else {
            where.status = { [Op.notIn]: [OrderStatusEnum.COMPLETED, OrderStatusEnum.CANCELLED] };
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
        return this._transition(
            id,
            [OrderStatusEnum.PENDING, OrderStatusEnum.PREPARING, OrderStatusEnum.READY],
            OrderStatusEnum.CANCELLED,
            'cancelled',
        );
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

        const data = await Order.findByPk(id, {
            attributes : ORDER_ATTRIBUTES,
            include    : DETAIL_INCLUDES,
        });

        return { data, message: `Order #${id} has been ${verb} successfully.` };
    }
}
