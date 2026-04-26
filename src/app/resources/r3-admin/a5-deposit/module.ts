// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { AuditLogService }        from '@app/services/audit-log.service';
import { AdminDepositController } from './controller';
import { AdminDepositService }    from './service';

@Module({
    controllers: [AdminDepositController],
    providers  : [AdminDepositService, AuditLogService],
})
export class AdminDepositModule {}
