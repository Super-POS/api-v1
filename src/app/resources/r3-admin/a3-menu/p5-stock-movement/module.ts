// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { AuditLogService }         from '@app/services/audit-log.service';
import { StockMovementController } from './controller';
import { StockMovementService }    from './service';

@Module({
    controllers: [StockMovementController],
    providers  : [StockMovementService, AuditLogService],
})
export class StockMovementModule {}
