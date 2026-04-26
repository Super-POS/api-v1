// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { AuditLogService }        from '@app/services/audit-log.service';
import { AdminPaymentController } from './controller';
import { AdminPaymentService }    from './service';

@Module({
    controllers: [AdminPaymentController],
    providers  : [AdminPaymentService, AuditLogService],
})
export class AdminPaymentModule {}
