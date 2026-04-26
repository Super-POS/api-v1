// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';

// ===========================================================================>> Costom Library
import { MenuReportController,} from './menu/controller';
import { MenuPDFService } from './menu/pdf-service';
import { MenuExcelReportService } from './menu/excel-service';
import { MenuReportService } from './menu/service';
import { CashierReportController } from './cashier/controller';
import { CashierReportService } from './cashier/service';
import { CashierPDFReportService } from './cashier/pdf-service';
import { CashierExcelReportService } from './cashier/excel-service';
import { SalePDFReportService } from './sale/pdf-service';
import { SaleExcelReportService } from './sale/excel-service';
import { SaleReportController } from './sale/controller';
import { SaleReportService } from './sale/service';
// ===> third party library
import { JsReportService } from 'src/app/services/js-report.service';

@Module({
    // controllers: [ReportController],
    controllers: [
        MenuReportController,
        CashierReportController,
        SaleReportController,
    ],
    // providers: [ReportService, JsReportService, TelegramService],
    providers:[
        MenuPDFService,
        MenuExcelReportService,
        MenuReportService,
        CashierReportService,
        JsReportService,
        CashierPDFReportService,
        CashierExcelReportService,
        SalePDFReportService,
        SaleExcelReportService,
        SaleReportService, // Add SaleReportService to the providers array
    ],
    imports: []
})
export class ReportModule { }
