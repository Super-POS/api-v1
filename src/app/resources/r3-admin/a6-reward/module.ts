// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { RewardEngineService }  from '@app/services/reward-engine.service';
import { AdminRewardController } from './controller';
import { AdminRewardService }    from './service';

@Module({
    controllers: [AdminRewardController],
    providers  : [AdminRewardService, RewardEngineService],
})
export class AdminRewardModule {}
