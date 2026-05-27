import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './service';

@Controller()
export class AnalyticsController {
    constructor(private readonly _service: AnalyticsService) {}

    /** Full ERP analytics dashboard in one request */
    @Get('dashboard')
    getDashboard(
        @Query('start_date') start_date: string,
        @Query('end_date')   end_date:   string,
    ) {
        return this._service.getDashboardSummary(start_date, end_date);
    }

    /** Best-selling items by quantity sold */
    @Get('best-sellers')
    getBestSellers(
        @Query('start_date') start_date: string,
        @Query('end_date')   end_date:   string,
        @Query('limit')      limit?:     number,
    ) {
        return this._service.getBestSellingItems(start_date, end_date, limit ? Number(limit) : 10);
    }

    /** Sales trend — daily, weekly, or monthly */
    @Get('sales-trend')
    getSalesTrend(
        @Query('start_date')   start_date:   string,
        @Query('end_date')     end_date:     string,
        @Query('granularity')  granularity?: 'daily' | 'weekly' | 'monthly',
    ) {
        return this._service.getSalesTrend(start_date, end_date, granularity ?? 'daily');
    }

    /** Peak hours — orders and revenue grouped by hour of day */
    @Get('peak-hours')
    getPeakHours(
        @Query('start_date') start_date: string,
        @Query('end_date')   end_date:   string,
    ) {
        return this._service.getPeakHours(start_date, end_date);
    }

    /** Profit, COGS, and margin breakdown per menu item */
    @Get('profit-by-product')
    getProfitByProduct(
        @Query('start_date') start_date: string,
        @Query('end_date')   end_date:   string,
    ) {
        return this._service.getProfitByProduct(start_date, end_date);
    }

    /** Ingredient waste analysis with waste % formula */
    @Get('waste-analysis')
    getWasteAnalysis(
        @Query('start_date') start_date: string,
        @Query('end_date')   end_date:   string,
    ) {
        return this._service.getWasteAnalysis(start_date, end_date);
    }
}
