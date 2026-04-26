// =========================================================================>> Core Library
import { Module } from '@nestjs/common';

// =========================================================================>> Custom Library
import { ProfitService }          from '@app/services/profit.service';
import { FinancialReportController } from './controller';
import { FinancialReportService }    from './service';

@Module({
    controllers: [FinancialReportController],
    providers  : [FinancialReportService, ProfitService],
})
export class FinancialReportModule {}
