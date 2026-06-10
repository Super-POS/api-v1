import { Module } from '@nestjs/common';
import { AdminCoffeeRankController } from './controller';
import { AdminRankRewardService } from './reward.service';

@Module({
    controllers: [AdminCoffeeRankController],
    providers  : [AdminRankRewardService],
})
export class AdminCoffeeRankModule {}
