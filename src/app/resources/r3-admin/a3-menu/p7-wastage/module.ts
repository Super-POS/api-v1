// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { AuditLogService } from '@app/services/audit-log.service';
import { WastageController } from './controller';
import { WastageService }    from './service';

@Module({
    controllers: [WastageController],
    providers  : [WastageService, AuditLogService],
})
export class WastageModule {}
