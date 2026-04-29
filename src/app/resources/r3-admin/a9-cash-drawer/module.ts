// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { AuditLogService }          from '@app/services/audit-log.service';
import { AdminCashDrawerController } from './controller';
import { AdminCashDrawerService }    from './service';

@Module({
    controllers: [AdminCashDrawerController],
    providers  : [AdminCashDrawerService, AuditLogService],
})
export class AdminCashDrawerModule {}
