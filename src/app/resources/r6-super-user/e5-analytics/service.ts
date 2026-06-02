import { Injectable } from '@nestjs/common';
import { fn, col, literal, Op } from 'sequelize';
import Order from '@app/models/order/order.model';
import OrderDetails from '@app/models/order/detail.model';
import Menu from '@app/models/menu/menu.model';
import MenuIngredient from '@app/models/menu/menu-ingredient.model';
import IngredientWastage from '@app/models/menu/wastage.model';
import MenuType from '@app/models/menu/menu-type.model';
import ErpOperatingExpense from '@app/models/erp/operating-expense.model';
import ErpPayroll, { PayrollStatus } from '@app/models/erp/payroll.model';
import { OrderStatusEnum } from '@app/enums/order-status.enum';
import { ProfitService } from '@app/services/profit.service';
import { RecipeCostingService } from '../e4-recipe-costing/service';

const EXCLUDED = [OrderStatusEnum.CANCELLED, OrderStatusEnum.AWAITING_PAYMENT];

@Injectable()
export class AnalyticsService {

    constructor(
        private readonly profitService: ProfitService,
        private readonly costingService: RecipeCostingService,
    ) {}

    /**
     * Full analytics dashboard — all key metrics in one call.
     */
    async getDashboardSummary(start_date?: string, end_date?: string) {
        const [startDate, endDate] = this._dateRange(start_date, end_date);

        const [metrics, bestSellers, salesTrend, peakHours, wasteAnalysis, periodCosts] = await Promise.all([
            this.profitService.calculate(startDate, endDate),
            this._fetchBestSellingItems(start_date, end_date, 5),
            this._fetchSalesTrend(start_date, end_date, 'daily'),
            this._fetchPeakHours(start_date, end_date),
            this._fetchWasteAnalysis(start_date, end_date),
            this._getPeriodCosts(startDate, endDate),
        ]);

        const operatingExpenses = periodCosts.totalOpEx;
        const payrollCost       = periodCosts.payrollCost;
        const netProfit         = metrics.gross_profit - operatingExpenses - payrollCost;
        const netMarginPct      = metrics.revenue > 0 ? (netProfit / metrics.revenue) * 100 : 0;

        return {
            data: {
                financials: {
                    revenue            : metrics.revenue,
                    cogs               : metrics.cogs,
                    gross_profit       : metrics.gross_profit,
                    gross_margin_pct   : metrics.gross_margin_pct,
                    operating_expenses : this._round(operatingExpenses),
                    payroll_cost       : this._round(payrollCost),
                    net_profit         : this._round(netProfit),
                    net_margin_pct     : this._round(netMarginPct),
                },
                best_sellers  : this._mapBestSellers(bestSellers),
                sales_trend   : this._mapSalesTrend(salesTrend),
                peak_hours    : this._mapPeakHours(peakHours),
                waste_analysis: this._mapWasteAnalysis(wasteAnalysis),
            },
        };
    }

    /**
     * Best-selling items ranked by quantity sold.
     */
    async getBestSellingItems(start_date: string, end_date: string, limit = 10) {
        const result = await this._fetchBestSellingItems(start_date, end_date, limit);
        return { data: this._mapBestSellers(result) };
    }

    /**
     * Sales trend — daily, weekly, or monthly revenue aggregation.
     */
    async getSalesTrend(start_date: string, end_date: string, granularity: 'daily' | 'weekly' | 'monthly' = 'daily') {
        const result = await this._fetchSalesTrend(start_date, end_date, granularity);
        return { data: this._mapSalesTrend(result) };
    }

    /**
     * Peak hours — order count grouped by hour of day.
     */
    async getPeakHours(start_date: string, end_date: string) {
        const result = await this._fetchPeakHours(start_date, end_date);
        return { data: this._mapPeakHours(result) };
    }

    /**
     * Profit by product — revenue, cost, and margin per menu item.
     */
    async getProfitByProduct(start_date: string, end_date: string) {
        const [startDate, endDate] = this._dateRange(start_date, end_date);

        const menus = await this.costingService.getMenusWithCost();
        const costMap = new Map<number, number>();
        for (const m of menus) {
            if ((m as any).has_sizes) continue;
            costMap.set((m as any).id, (m as any).cost ?? 0);
        }

        const sales = await OrderDetails.findAll({
            attributes: [
                'menu_id',
                [fn('SUM', col('qty')), 'total_qty'],
                [fn('SUM', literal('"OrderDetails"."qty" * "OrderDetails"."unit_price"')), 'total_revenue'],
            ],
            include: [{
                model     : Order,
                attributes: [],
                where     : {
                    ordered_at: { [Op.between]: [startDate, endDate] },
                    status    : { [Op.notIn]: EXCLUDED },
                },
            }, {
                model     : Menu,
                attributes: ['id', 'name'],
            }],
            group: ['OrderDetails.menu_id', 'menu.id'],
        } as any);

        const rows = sales.map(s => {
            const menuId    = (s as any).menu_id;
            const revenue   = parseFloat((s as any).dataValues.total_revenue ?? '0');
            const qty       = parseInt((s as any).dataValues.total_qty ?? '0', 10);
            const unitCost  = costMap.get(menuId) ?? 0;
            const cogs      = qty * unitCost;
            const profit    = revenue - cogs;
            const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
            return {
                menu_id     : menuId,
                menu_name   : (s as any).menu?.name,
                total_qty   : qty,
                revenue     : parseFloat(revenue.toFixed(2)),
                cogs        : parseFloat(cogs.toFixed(2)),
                gross_profit: parseFloat(profit.toFixed(2)),
                margin_pct  : parseFloat(marginPct.toFixed(2)),
            };
        }).sort((a, b) => b.gross_profit - a.gross_profit);

        return { data: rows };
    }

    /**
     * Waste analysis per ingredient.
     */
    async getWasteAnalysis(start_date: string, end_date: string) {
        const rows = await this._fetchWasteAnalysis(start_date, end_date);
        return { data: this._mapWasteAnalysis(rows) };
    }

    // ─── Private fetch helpers ────────────────────────────────────────────────

    private async _fetchBestSellingItems(start_date: string, end_date: string, limit = 10) {
        const [startDate, endDate] = this._dateRange(start_date, end_date);

        return OrderDetails.findAll({
            attributes: [
                'menu_id',
                [fn('SUM', col('qty')), 'total_qty'],
                [fn('SUM', literal('"OrderDetails"."qty" * "OrderDetails"."unit_price"')), 'total_revenue'],
            ],
            include: [
                {
                    model     : Order,
                    attributes: [],
                    where     : {
                        ordered_at: { [Op.between]: [startDate, endDate] },
                        status    : { [Op.notIn]: EXCLUDED },
                    },
                },
                {
                    model     : Menu,
                    attributes: ['id', 'name', 'code', 'image'],
                    include   : [{ model: MenuType, attributes: ['id', 'name'] }],
                },
            ],
            group : ['OrderDetails.menu_id', 'menu.id', 'menu.type.id'],
            order : [[literal('total_qty'), 'DESC']],
            limit,
        } as any);
    }

    private async _fetchSalesTrend(start_date: string, end_date: string, granularity: 'daily' | 'weekly' | 'monthly' = 'daily') {
        const [startDate, endDate] = this._dateRange(start_date, end_date);

        let dateTrunc: string;
        switch (granularity) {
            case 'weekly':  dateTrunc = 'week';  break;
            case 'monthly': dateTrunc = 'month'; break;
            default:        dateTrunc = 'day';
        }

        return Order.findAll({
            attributes: [
                [fn('DATE_TRUNC', dateTrunc, col('ordered_at')), 'period'],
                [fn('COUNT', col('id')), 'order_count'],
                [fn('SUM', col('total_price')), 'revenue'],
            ],
            where: {
                ordered_at: { [Op.between]: [startDate, endDate] },
                status    : { [Op.notIn]: EXCLUDED },
            },
            group: [literal(`DATE_TRUNC('${dateTrunc}', ordered_at)`)],
            order: [[literal(`DATE_TRUNC('${dateTrunc}', ordered_at)`), 'ASC']],
        } as any);
    }

    private async _fetchPeakHours(start_date: string, end_date: string) {
        const [startDate, endDate] = this._dateRange(start_date, end_date);

        return Order.findAll({
            attributes: [
                [fn('EXTRACT', literal('HOUR FROM ordered_at')), 'hour'],
                [fn('COUNT', col('id')), 'order_count'],
                [fn('SUM', col('total_price')), 'revenue'],
            ],
            where: {
                ordered_at: { [Op.between]: [startDate, endDate] },
                status    : { [Op.notIn]: EXCLUDED },
            },
            group: [literal('EXTRACT(HOUR FROM ordered_at)')],
            order: [[literal('EXTRACT(HOUR FROM ordered_at)'), 'ASC']],
        } as any);
    }

    private async _fetchWasteAnalysis(start_date: string, end_date: string) {
        const [startDate, endDate] = this._dateRange(start_date, end_date);

        const wastages = await IngredientWastage.findAll({
            where: {
                created_at: { [Op.between]: [startDate, endDate] },
            },
            include: [{ model: MenuIngredient, as: 'ingredient', attributes: ['id', 'name', 'unit', 'quantity', 'unit_cost'] }],
        });

        return wastages.map(w => {
            const totalInventory = Number((w as any).ingredient?.quantity ?? 0);
            const wasteQty       = Number((w as any).quantity ?? 0);
            const unitCost       = Number((w as any).ingredient?.unit_cost ?? 0);
            const wastePct       = totalInventory > 0 ? (wasteQty / totalInventory) * 100 : 0;
            return {
                ingredient_id  : (w as any).ingredient_id,
                ingredient_name: (w as any).ingredient?.name,
                unit           : (w as any).ingredient?.unit,
                waste_qty      : wasteQty,
                total_inventory: totalInventory,
                waste_pct      : parseFloat(wastePct.toFixed(2)),
                waste_cost     : parseFloat((wasteQty * unitCost).toFixed(2)),
                reason         : (w as any).reason,
                date           : (w as any).created_at,
            };
        });
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private _dateRange(start?: string, end?: string): [Date, Date] {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const s = start ? new Date(start) : todayStart;
        const e = end   ? new Date(end)   : new Date(now.getFullYear(), now.getMonth(), now.getDate());
        e.setHours(23, 59, 59, 999);
        return [s, e];
    }

    private async _getPeriodCosts(startDate: Date, endDate: Date) {
        const expenses = await ErpOperatingExpense.findAll({
            where: { date: { [Op.between]: [startDate, endDate] } },
        });
        const totalOpEx = expenses.reduce((s, e) => s + Number(e.amount), 0);

        const payrolls = await ErpPayroll.findAll({
            where: {
                status      : { [Op.in]: [PayrollStatus.FINALIZED, PayrollStatus.PAID] },
                period_start: { [Op.lte]: endDate },
                period_end  : { [Op.gte]: startDate },
            },
        });
        const payrollCost = payrolls.reduce((s, p) => s + Number(p.total_amount), 0);

        return { totalOpEx, payrollCost };
    }

    private _mapBestSellers(rows: any[]) {
        return rows.map(r => {
            const dv = (r as any).dataValues ?? r;
            return {
                menu_id      : dv.menu_id ?? (r as any).menu_id,
                menu_name    : (r as any).menu?.name ?? '',
                total_qty    : parseInt(String(dv.total_qty ?? 0), 10),
                total_revenue: parseFloat(String(dv.total_revenue ?? 0)),
            };
        });
    }

    private _mapSalesTrend(rows: any[]) {
        return rows.map(r => {
            const dv = (r as any).dataValues ?? r;
            const period = dv.period instanceof Date
                ? dv.period.toISOString().slice(0, 10)
                : String(dv.period ?? '').slice(0, 10);
            return {
                period,
                order_count  : parseInt(String(dv.order_count ?? 0), 10),
                total_revenue: parseFloat(String(dv.revenue ?? 0)),
            };
        });
    }

    private _mapPeakHours(rows: any[]) {
        return rows.map(r => {
            const dv = (r as any).dataValues ?? r;
            return {
                hour         : parseInt(String(dv.hour ?? 0), 10),
                order_count  : parseInt(String(dv.order_count ?? 0), 10),
                total_revenue: parseFloat(String(dv.revenue ?? 0)),
            };
        });
    }

    private _mapWasteAnalysis(rows: any[]) {
        return rows.map(r => ({
            ingredient_id  : r.ingredient_id,
            ingredient_name: r.ingredient_name ?? '',
            waste_qty      : Number(r.waste_qty ?? 0),
            waste_pct      : Number(r.waste_pct ?? 0),
            waste_cost     : Number(r.waste_cost ?? 0),
        }));
    }

    private _round(v: number, d = 2) {
        return parseFloat(v.toFixed(d));
    }
}
