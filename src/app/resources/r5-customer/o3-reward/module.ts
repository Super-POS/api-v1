// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { RewardEngineService }    from '@app/services/reward-engine.service';
import { CustomerRewardController } from './controller';
import { CustomerRewardService }    from './service';

@Module({
    controllers: [CustomerRewardController],
    providers  : [CustomerRewardService, RewardEngineService],
})
export class CustomerRewardModule {}
