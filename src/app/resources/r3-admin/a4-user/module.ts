// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';

// ===========================================================================>> Costom Library
import { AuditLogService } from '@app/services/audit-log.service';
import { FileService }     from 'src/app/services/file.service';
import { UserController }  from './controller';
import { UserService }     from './service';

@Module({
    providers  : [UserService, FileService, AuditLogService],
    controllers: [UserController],
})
export class UserModule { }