// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { AdminMissionController } from './controller';
import { AdminMissionService }    from './mission.service';
import { AdminStampService }      from './stamp.service';

@Module({
    controllers: [AdminMissionController],
    providers  : [AdminMissionService, AdminStampService],
})
export class AdminMissionModule {}
