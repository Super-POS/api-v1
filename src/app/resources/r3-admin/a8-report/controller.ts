// =========================================================================>> Core Library
import { Controller, Get, Query, UseGuards } from '@nestjs/common';

// =========================================================================>> Custom Library
import { RolesDecorator }           from '@app/core/decorators/roles.decorator';
import { RoleGuard }                from '@app/core/guards/role.guard';
import { RoleEnum }                 from '@app/enums/role.enum';
import { FinancialReportService }   from './service';

@Controller()
@UseGuards(RoleGuard)
@RolesDecorator(RoleEnum.ADMIN)
export class FinancialReportController {

    constructor(private readonly _service: FinancialReportService) {}

    /**
     * GET /api/admin/reports/financial
     *
     * Supported query params (choose one period shortcut OR from+to):
     *   today | yesterday | thisWeek | thisMonth | threeMonthAgo | sixMonthAgo
     *   from=YYYY-MM-DD  &  to=YYYY-MM-DD  (custom range, inclusive)
     *   granularity=daily|weekly|monthly  (default: auto)
     */
    @Get('financial')
    async getFinancialReport(
        @Query('from')           from?          : string,
        @Query('to')             to?            : string,
        @Query('today')          today?         : string,
        @Query('yesterday')      yesterday?     : string,
        @Query('thisWeek')       thisWeek?      : string,
        @Query('thisMonth')      thisMonth?     : string,
        @Query('threeMonthAgo')  threeMonthAgo? : string,
        @Query('sixMonthAgo')    sixMonthAgo?   : string,
        @Query('granularity')    granularity?   : 'daily' | 'weekly' | 'monthly',
    ) {
        return await this._service.getFinancialReport({
            from, to, today, yesterday, thisWeek, thisMonth, threeMonthAgo, sixMonthAgo, granularity,
        });
    }

    /**
     * GET /api/admin/reports/audit-logs
     *
     * Query params:
     *   page, limit, action, actor_id, from, to
     */
    @Get('audit-logs')
    async getAuditLogs(
        @Query('page')     page?    : number,
        @Query('limit')    limit?   : number,
        @Query('action')   action?  : string,
        @Query('actor_id') actor_id?: number,
        @Query('from')     from?    : string,
        @Query('to')       to?      : string,
    ) {
        return await this._service.getAuditLogs({ page, limit, action, actor_id, from, to });
    }
}
