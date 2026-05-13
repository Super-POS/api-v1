// ===========================================================================>> Core Library
import { Module }             from '@nestjs/common';
import { HttpModule }         from '@nestjs/axios';

// ===========================================================================>> Custom Library
import { RewardEngineService }      from '@app/services/reward-engine.service';
import { BadgeAiService }           from '@app/services/badge-ai.service';
import { CustomerRewardController } from './controller';
import { CustomerRewardService }    from './service';

@Module({
    imports    : [HttpModule],
    controllers: [CustomerRewardController],
    providers  : [CustomerRewardService, RewardEngineService, BadgeAiService],
})
export class CustomerRewardModule {}
