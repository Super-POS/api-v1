// ===========================================================================>> Custom Library
import { Controller, Get, Query, UseGuards } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { RolesDecorator }   from '@app/core/decorators/roles.decorator';
import { RoleGuard }        from '@app/core/guards/role.guard';
import { RoleEnum }         from '@app/enums/role.enum';
import { DashboardService } from './service';

@Controller()
export class DashboardController {

    constructor(
        private readonly _service: DashboardService
    ) { }

    @Get()
    async getStaticData(
        @Query('today')         today?        : string,
        @Query('yesterday')     yesterday?    : string,
        @Query('thisWeek')      thisWeek?     : string,
        @Query('thisMonth')     thisMonth?    : string,
        @Query('threeMonthAgo') threeMonthAgo?: string,
        @Query('sixMonthAgo')   sixMonthAgo?  : string,
        @Query('type')          type?         : number,
    ) {
        return await this._service.findStaticData({ today, yesterday, thisWeek, thisMonth, threeMonthAgo, sixMonthAgo, type });
    }

    @Get('/cashier')
    async getCashierAndTotalSale(
        @Query('today')     today?    : string,
        @Query('yesterday') yesterday?: string,
        @Query('thisWeek')  thisWeek? : string,
        @Query('thisMonth') thisMonth?: string,
    ) {
        return await this._service.findCashierAndTotalSale({ today, yesterday, thisWeek, thisMonth });
    }

    @Get('/product-type')
    async getProductTypeWithProductHaveUsed(
        @Query('thisWeek')      thisWeek?     : string,
        @Query('thisMonth')     thisMonth?    : string,
        @Query('threeMonthAgo') threeMonthAgo?: string,
        @Query('sixMonthAgo')   sixMonthAgo?  : string,
    ) {
        return await this._service.findProductTypeWithProductHaveUsed({ thisWeek, thisMonth, threeMonthAgo, sixMonthAgo });
    }

    @Get('/data-sale')
    async getDataSaleDayOfWeek(
        @Query('thisWeek')      thisWeek?     : string,
        @Query('thisMonth')     thisMonth?    : string,
        @Query('threeMonthAgo') threeMonthAgo?: string,
        @Query('sixMonthAgo')   sixMonthAgo?  : string,
    ) {
        return await this._service.findDataSaleDayOfWeek({ thisWeek, thisMonth, threeMonthAgo, sixMonthAgo });
    }

    /**
     * GET /admin/dashboard/profit
     *
     * Returns revenue, COGS, gross profit, net profit, and margin percentages
     * for the requested period (defaults to the current week).
     *
     * Query params (mutually exclusive, pick one):
     *   today | yesterday | thisWeek | thisMonth | threeMonthAgo | sixMonthAgo
     */
    @Get('/profit')
    @UseGuards(RoleGuard)
    @RolesDecorator(RoleEnum.ADMIN)
    async getProfitMetrics(
        @Query('today')         today?        : string,
        @Query('yesterday')     yesterday?    : string,
        @Query('thisWeek')      thisWeek?     : string,
        @Query('thisMonth')     thisMonth?    : string,
        @Query('threeMonthAgo') threeMonthAgo?: string,
        @Query('sixMonthAgo')   sixMonthAgo?  : string,
    ) {
        return await this._service.findProfitMetrics({ today, yesterday, thisWeek, thisMonth, threeMonthAgo, sixMonthAgo });
    }

}
