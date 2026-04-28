// ===========================================================================>> Core Library
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

// ===========================================================================>> Third party Library
import { Op, Order as SeqOrder, col, Sequelize } from 'sequelize';
// ===========================================================================>> Costom Library

import User         from '@app/models/user/user.model';
import Order        from '@app/models/order/order.model';
import OrderDetails from '@app/models/order/detail.model';
import OrderDetailModifier from '@app/models/order/order-detail-modifier.model';
import Menu      from '@app/models/menu/menu.model';
import MenuType  from '@app/models/menu/menu-type.model';

@Injectable()
export class SaleService {

    public shortItems = [
        
        {
            value    : 'total_price', 
            name     : 'Sale amount'
        }
        ,{
            value    : 'ordered_at', 
            name     : 'Order date'
        },
    ];

    async getSetupData() {
        const cashiers = await User.findAll({
            attributes: ['id', 'name'],
        }); 

        
        return { 
            cashiers    : cashiers,
            shortItems  : this.shortItems,
            // platform    : this.platform
        };
    }

    private _saleListWhere(params?: {
        key?: string;
        cashier?: number;
        platform?: string;
        fromDate?: string;
        toDate?: string;
    }): any {
        const where: any = {};
        if (params?.key && params.key != '') {
            where.receipt_number = { [Op.like]: `%${params?.key}%` };
        }
        if (params?.cashier) {
            where.cashier_id = params.cashier;
        }
        if (params?.platform !== null && params?.platform !== undefined && params?.platform !== '') {
            where.channel = params.platform;
        }
        if (params?.fromDate && params?.toDate && params.toDate !== 'undefined 23:59:59') {
            const fromDate = new Date(params.fromDate);
            const toDate = new Date(params.toDate);
            toDate.setHours(23, 59, 59, 999);
            where.ordered_at = { [Op.between]: [fromDate, toDate] };
        }
        return where;
    }

    /**
     * CSV export for the same filters as the sales list (max 50k rows).
     */
    async exportSalesCsv(
        params?: {
            key?: string;
            cashier?: number;
            platform?: string;
            fromDate?: string;
            toDate?: string;
        },
    ): Promise<string> {
        const where = this._saleListWhere(params);
        const rows = await Order.findAll({
            attributes: ['id', 'receipt_number', 'total_price', 'channel', 'status', 'ordered_at'],
            where,
            include: [{ model: User, as: 'cashier', attributes: ['name'] }],
            order: [[col('id'), 'DESC']],
            limit: 50000,
        });
        const header = 'id,receipt_number,total_price_riel,channel,status,ordered_at,cashier_name\n';
        const q = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`;
        const body = rows
            .map((r) => {
                const o = r.toJSON() as unknown as {
                    id: number;
                    receipt_number: string;
                    total_price?: number;
                    channel: string;
                    status: string;
                    ordered_at?: Date | string;
                    cashier?: { name?: string };
                };
                const dt = o.ordered_at ? new Date(o.ordered_at as Date).toISOString() : '';
                return [
                    o.id,
                    q(String(o.receipt_number)),
                    o.total_price ?? 0,
                    q(String(o.channel)),
                    q(String(o.status)),
                    q(dt),
                    q(String(o.cashier?.name ?? '')),
                ].join(',');
            })
            .join('\n');
        return header + body;
    }

    async getData(
        params?: {
            //=========================>> Pagination
            page?           : number,
            limit?          : number, 

            //=========================>> Search
            key?            : string,

            //=========================>> Sort
            sort?           : string,
            order?          : string,
            
            //=========================>> Filter
            cashier?        : number;
            platform?       : string;
            
            fromDate?       : string;
            toDate?         : string;
        }
    ) {

        try {
            // return params; 

            // ===>> Calculate Pagination Page
            const offset = (params.page - 1) * params.limit;

            // ===>> Build the dynamic `where` clause
            const where = this._saleListWhere(params);

            // ===>> Build Sort & Order
            const order     = [];
            
            // check if the params?.order is in the shortItems. 
            if(params?.order){
                this.shortItems.forEach(e =>{
                    if(e.value == params?.sort){
                        order.push([ col(params?.sort), params?.order ]); 
                    }
                    
                }); 
            }

            // Default order
            order.push([ col('id'), 'DESC' ]); 

            // ===>> Query Data from Database
            const { rows, count }  = await Order.findAndCountAll({
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
                                    {   model: MenuType, 
                                        attributes: ['name'] 
                                    }
                                ],
                            },
                        ],
                    },
                    {
                        model: User,
                        as: 'cashier',
                        attributes: ['id', 'avatar', 'name']
                    },
                ],

                where       : where,
                distinct    : true,
                order       : order,
                limit       : params.limit,
                offset      : offset,
            });

            // Calculate total pages
            const totalPage = Math.ceil(count / params.limit);

            return  {
                params: params,
                data    : rows,

                pagination: {
                    page        : params.page,
                    limit       : params.limit,
                    totalPage   : totalPage,
                    total       : count,
                }, 
                
            };

        } catch (error) {

            console.error('admin/sale/getData', error);
            throw new BadRequestException(error.message);

        }
    }


    async delete(id: number): Promise<{ message: string }> {
        try {
            const rowsAffected = await Order.destroy({
                where: {
                    id: id
                }
            });

            if (rowsAffected === 0) {
                throw new NotFoundException('Sale record not found.');
            }

            return { message: 'This order has been deleted successfully.' };
        } catch (error) {
            throw new BadRequestException(error.message ?? 'Something went wrong!. Please try again later.', 'Error Delete');
        }
    }
}
