// =========================================================================>> Core Library
import { Injectable } from '@nestjs/common';

// =========================================================================>> Third Party Library
import { fn, col, Op, literal } from 'sequelize';

// =========================================================================>> Custom Library
import { ProfitService }    from '@app/services/profit.service';
import Order                from '@app/models/order/order.model';
import OrderDetails         from '@app/models/order/detail.model';
import Product              from '@app/models/product/product.model';
import ProductType          from '@app/models/product/type.model';
import PaymentTransaction, { PaymentStatus } from '@app/models/payment/payment_transaction.model';
import Wallet               from '@app/models/wallet/wallet.model';
import WalletTransaction, { DepositStatus, WalletTransactionType } from '@app/models/wallet/wallet_transaction.model';
import UsersLogs            from '@app/models/user/user_logs.model';
import User                 from '@app/models/user/user.model';

export interface ReportFilters {
    from?        : string;
    to?          : string;
    today?       : string;
    yesterday?   : string;
    thisWeek?    : string;
    thisMonth?   : string;
    threeMonthAgo?: string;
    sixMonthAgo? : string;
    granularity? : 'daily' | 'weekly' | 'monthly';
}

@Injectable()
export class FinancialReportService {

    constructor(private readonly profitService: ProfitService) {}

    // =========================================================================
    // Main report entry point
    // =========================================================================

    async getFinancialReport(filters: ReportFilters): Promise<any> {
        const { startDate, endDate } = this._resolvePeriod(filters);

        const [
            profit,
            orderSummary,
            revenueSeries,
            paymentBreakdown,
            channelBreakdown,
            topProducts,
            walletSummary,
        ] = await Promise.all([
            this.profitService.calculate(startDate, endDate),
            this._orderSummary(startDate, endDate),
            this._revenueSeries(startDate, endDate, filters.granularity),
            this._paymentBreakdown(startDate, endDate),
            this._channelBreakdown(startDate, endDate),
            this._topProducts(startDate, endDate),
            this._walletSummary(startDate, endDate),
        ]);

        return {
            data: {
                period: {
                    from: startDate.toISOString(),
                    to  : endDate.toISOString(),
                },
                summary: {
                    total_orders    : orderSummary.count,
                    revenue         : profit.revenue,
                    cogs            : profit.cogs,
                    gross_profit    : profit.gross_profit,
                    net_profit      : profit.net_profit,
                    gross_margin_pct: profit.gross_margin_pct,
                    net_margin_pct  : profit.net_margin_pct,
                },
                revenue_series  : revenueSeries,
                payment_breakdown: paymentBreakdown,
                channel_breakdown: channelBreakdown,
                top_products    : topProducts,
                wallet_summary  : walletSummary,
            },
            message: 'Financial report retrieved successfully.',
        };
    }

    // =========================================================================
    // Audit-log viewer (readable by admin)
    // =========================================================================

    async getAuditLogs(filters: {
        page?    : number;
        limit?   : number;
        action?  : string;
        actor_id?: number;
        from?    : string;
        to?      : string;
    }): Promise<any> {
        const page   = Number(filters.page  ?? 1);
        const limit  = Number(filters.limit ?? 20);
        const offset = (page - 1) * limit;

        const where: any = {};
        if (filters.action)   where.action  = filters.action;
        if (filters.actor_id) where.user_id = filters.actor_id;
        if (filters.from || filters.to) {
            where.created_at = {};
            if (filters.from) where.created_at[Op.gte] = new Date(filters.from);
            if (filters.to)   where.created_at[Op.lte] = new Date(filters.to);
        }

        const { rows, count } = await UsersLogs.findAndCountAll({
            where,
            include: [{ model: User, attributes: ['id', 'name', 'avatar'], required: false }],
            order  : [['created_at', 'DESC']],
            limit,
            offset,
        });

        return {
            data: rows,
            pagination: {
                page,
                limit,
                totalPage: Math.ceil(count / limit),
                total    : count,
            },
        };
    }

    // =========================================================================
    // Private helpers
    // =========================================================================

    private async _orderSummary(start: Date, end: Date) {
        const count = await Order.count({
            where: { ordered_at: { [Op.between]: [start, end] } },
        });
        return { count };
    }

    /**
     * Revenue grouped by day or by month, depending on granularity.
     * Auto-selects monthly if the range exceeds 60 days, unless overridden.
     */
    private async _revenueSeries(start: Date, end: Date, granularity?: 'daily' | 'weekly' | 'monthly') {
        const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        const grain    = granularity ?? (diffDays > 60 ? 'monthly' : 'daily');

        // Truncate date to the chosen granularity (PostgreSQL syntax)
        const truncExpr = grain === 'monthly'
            ? literal(`DATE_TRUNC('month', "ordered_at")`)
            : grain === 'weekly'
                ? literal(`DATE_TRUNC('week', "ordered_at")`)
                : fn('DATE', col('ordered_at'));

        const rows = await Order.findAll({
            attributes: [
                [truncExpr, 'period'],
                [fn('COUNT', col('id')),          'order_count'],
                [fn('SUM', col('total_price')),   'revenue'],
            ],
            where: { ordered_at: { [Op.between]: [start, end] } },
            group: ['period'],
            order: [[literal('period'), 'ASC']],
            raw  : true,
        });

        return { granularity: grain, rows };
    }

    /** Revenue and transaction count per payment method (SUCCESS payments only) */
    private async _paymentBreakdown(start: Date, end: Date) {
        const rows = await PaymentTransaction.findAll({
            attributes: [
                'method',
                [fn('COUNT', col('id')),        'transaction_count'],
                [fn('SUM', col('amount')),       'total_amount'],
            ],
            where: {
                status    : PaymentStatus.SUCCESS,
                created_at: { [Op.between]: [start, end] },
            },
            group: ['method'],
            raw  : true,
        });
        return rows;
    }

    /** Order count and revenue per sales channel */
    private async _channelBreakdown(start: Date, end: Date) {
        const rows = await Order.findAll({
            attributes: [
                'channel',
                [fn('COUNT', col('id')),         'order_count'],
                [fn('SUM', col('total_price')),  'revenue'],
            ],
            where: { ordered_at: { [Op.between]: [start, end] } },
            group: ['channel'],
            raw  : true,
        });
        return rows;
    }

    /** Top 10 products by revenue in the period */
    private async _topProducts(start: Date, end: Date) {
        const rows = await OrderDetails.findAll({
            attributes: [
                'product_id',
                [fn('SUM', literal('"OrderDetails"."qty" * "OrderDetails"."unit_price"')), 'revenue'],
                [fn('SUM', col('qty')), 'total_qty'],
            ],
            include: [
                {
                    model     : Order,
                    attributes: [],
                    where     : { ordered_at: { [Op.between]: [start, end] } },
                    required  : true,
                },
                {
                    model     : Product,
                    attributes: ['id', 'name', 'code', 'image'],
                    include   : [{ model: ProductType, attributes: ['id', 'name'] }],
                },
            ],
            group : ['OrderDetails.product_id', 'product.id', 'product->type.id'],
            order : [[literal('revenue'), 'DESC']],
            limit : 10,
        });
        return rows;
    }

    /** Wallet: total deposits approved, payments, refunds in the period */
    private async _walletSummary(start: Date, end: Date) {
        const [deposits, payments, refunds] = await Promise.all([
            WalletTransaction.sum('amount', {
                where: {
                    type      : WalletTransactionType.DEPOSIT,
                    status    : DepositStatus.APPROVED,
                    created_at: { [Op.between]: [start, end] },
                },
            }),
            WalletTransaction.sum('amount', {
                where: {
                    type      : WalletTransactionType.PAYMENT,
                    created_at: { [Op.between]: [start, end] },
                },
            }),
            WalletTransaction.sum('amount', {
                where: {
                    type      : WalletTransactionType.REFUND,
                    created_at: { [Op.between]: [start, end] },
                },
            }),
        ]);

        return {
            total_deposits_approved: Number(deposits ?? 0),
            total_payments         : Number(payments  ?? 0),
            total_refunds          : Number(refunds   ?? 0),
        };
    }

    // =========================================================================
    // Date-period resolver (mirrors DashboardService logic)
    // =========================================================================

    private _resolvePeriod(filters: ReportFilters): { startDate: Date; endDate: Date } {
        // Explicit from/to takes priority
        if (filters.from || filters.to) {
            const startDate = filters.from ? new Date(filters.from) : new Date('2000-01-01');
            const endDate   = filters.to   ? new Date(new Date(filters.to).setHours(23, 59, 59, 999)) : new Date();
            return { startDate, endDate };
        }

        const now    = new Date();
        const endDate = this._endOfDay(new Date());

        if (filters.yesterday) {
            const d = new Date(filters.yesterday);
            return { startDate: this._startOfDay(d), endDate: this._endOfDay(new Date(d)) };
        }
        if (filters.today) {
            return { startDate: this._startOfDay(new Date()), endDate };
        }
        if (filters.thisWeek) {
            return { startDate: this._startOfWeek(now), endDate };
        }
        if (filters.thisMonth) {
            return { startDate: new Date(now.getFullYear(), now.getMonth(), 1), endDate };
        }
        if (filters.threeMonthAgo) {
            const s = new Date(now.getFullYear(), now.getMonth() - 3, 1);
            return { startDate: s, endDate };
        }
        if (filters.sixMonthAgo) {
            const s = new Date(now.getFullYear(), now.getMonth() - 6, 1);
            return { startDate: s, endDate };
        }

        // Default: current month
        return { startDate: new Date(now.getFullYear(), now.getMonth(), 1), endDate };
    }

    private _startOfDay(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0); }
    private _endOfDay(d: Date): Date   { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999); }
    private _startOfWeek(d: Date): Date {
        const day  = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return this._startOfDay(new Date(d.getFullYear(), d.getMonth(), diff));
    }
}
