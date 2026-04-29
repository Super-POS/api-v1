// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { AuditLogService }           from '@app/services/audit-log.service';
import { CashierCashDrawerController } from './controller';
import { CashierCashDrawerService }    from './service';

@Module({
    controllers: [CashierCashDrawerController],
    providers  : [CashierCashDrawerService, AuditLogService],
})
export class CashierCashDrawerModule {}
