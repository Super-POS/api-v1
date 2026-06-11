// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { CustomerMissionController } from './controller';
import { CustomerMissionService }    from './service';

@Module({
    controllers: [CustomerMissionController],
    providers  : [CustomerMissionService],
    exports    : [CustomerMissionService],
})
export class CustomerMissionModule {}
