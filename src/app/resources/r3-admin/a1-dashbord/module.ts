import { Module } from '@nestjs/common';
import { DashboardController } from './controller';
import { DashboardService } from './service';
import { JsReportService } from '@app/services/js-report.service';
import { ProfitService } from '@app/services/profit.service';

@Module({
    controllers: [DashboardController],
    providers: [DashboardService, JsReportService, ProfitService],
})
export class DashboardModule { }
