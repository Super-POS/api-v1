// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { RewardEngineService }     from '@app/services/reward-engine.service';
import { CustomerProfileController } from './controller';
import { CustomerProfileService }    from './service';

@Module({
    controllers: [CustomerProfileController],
    providers  : [CustomerProfileService, RewardEngineService],
})
export class CustomerProfileModule {}
