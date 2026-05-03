// ================================================================>> Core Library
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Op } from 'sequelize';
// ================================================================>> Costom Library
import { JsReportService } from '@app/services/js-report.service';
import OrderDetails from '@app/models/order/detail.model';
import Order from '@app/models/order/order.model';
import Menu from '@app/models/menu/menu.model';
import User from '@app/models/user/user.model';
import { ExchangeSettingService, khrToUsdDisplay } from '@app/services/exchange-setting.service';

@Injectable()
export class InvoiceService {
    constructor(
        private jsReportService: JsReportService,
        private readonly _exchangeSetting: ExchangeSettingService,
    ) { }

    // Method to generate an invoice report
    /** `receipt_number` is stored as varchar; keep a string so PG never compares varchar to a number. */
    async generateReport(receiptNumber: string) {
        // Retrieving orders related to the specified receipt number
        const orders = await Order.findAll({
            where: {
                receipt_number: receiptNumber,
            },
            include: [
                { model: User, as: 'cashier', attributes: ['id', 'name'] },
                { model: User, as: 'customer', attributes: ['id', 'name'] },
                {
                    model: OrderDetails,
                    attributes: ['id', 'unit_price', 'qty'],
                    include: [
                        {
                            model: Menu,
                            attributes: ['id', 'name', 'image'],
                        }
                    ]
                },
            ],
            order: [['id', 'DESC']],
        });

        if (!orders || orders.length === 0) {
            throw new NotFoundException('Order not found');
        }

        const khrPerUsd = await this._exchangeSetting.getKhrPerUsd();

        // Structuring the data for the report
        const data = orders[0].toJSON() as unknown as Record<string, unknown>;

        const detailsRaw = data.details as Array<Record<string, unknown>> | undefined;
        const details = Array.isArray(detailsRaw)
            ? detailsRaw.map((line) => ({
                ...line,
                product: line.product ?? line.menu ?? null,
                unit_price_usd: khrToUsdDisplay(Number(line.unit_price ?? 0), khrPerUsd),
                line_total_usd: khrToUsdDisplay(
                    Number(line.unit_price ?? 0) * Number(line.qty ?? 0),
                    khrPerUsd,
                ),
            }))
            : [];

        const orderedAt = data.ordered_at ?? data.created_at ?? new Date().toISOString();

        const dataWithServiceTitle = {
            ...data,
            details,
            ordered_at: orderedAt,
            title_of_service: 'CamCyber POS',
            khr_per_usd: khrPerUsd,
            total_price_usd: khrToUsdDisplay(Number(data.total_price ?? 0), khrPerUsd),
        };
        // Get the report template
        const template = process.env.JS_TEMPLATE;

        try {
            // Generating the report using the JsReportService
            const result = await this.jsReportService.generateReport(template, dataWithServiceTitle);
            if (result.error) {
                throw new BadRequestException(result.error);
            }
            return result;
        } catch (error) {
            // Log the error or handle it in a more appropriate way
            throw new BadRequestException(error?.message || 'Failed to generate the report');
        }
    }


    async generateReportBaseOnStartDateAndEndDate(startDate: string, endDate: string) {
        // Retrieving orders within the specified date range
        const orders = await Order.findAll({
            where: {
                ordered_at: {
                    [Op.between]: [startDate, endDate],
                },
            },
            include: [
                { model: User, as: 'cashier', attributes: ['id', 'name'] },
                { model: User, as: 'customer', attributes: ['id', 'name'] },
                {
                    model: OrderDetails,
                    attributes: ['id', 'unit_price', 'qty'],
                    include: [
                        {
                            model: Menu,
                            attributes: ['id', 'name', 'image'],
                        }
                    ]
                },
            ],
            order: [['id', 'DESC']],
        });

        // Handling case when no orders are found
        if (!orders || orders.length === 0) {
            return { message: 'No orders found within the specified date range' };
        }

        // Calculating the total price of all orders
        let total = 0;
        orders.forEach((row) => {
            total += row.total_price;
        });

        // Structuring the data for the report
        const data = orders.map(order => order.toJSON()); // Convert Sequelize instances to plain objects

        const dataWithServiceTitle = data.map(order => ({
            ...order,
            title_of_service: 'Car Service',
        }));

        // Get the report template
        const template = process.env.JS_TEMPLATE;

        try {
            // Generating the report using the JsReportService
            const result = await this.jsReportService.generateReport(template, dataWithServiceTitle);
            if (result.error) {
                throw new BadRequestException(result.error);
            }

            // Returning the generated report
            return result;
        } catch (error) {
            // Log the error or handle it in a more appropriate way
            throw new BadRequestException(error?.message || 'Failed to generate the report');
        }
    }

}
