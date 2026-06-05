import { Module } from '@nestjs/common';
import { AdminCoffeeRankController } from './controller';

@Module({
    controllers: [AdminCoffeeRankController],
})
export class AdminCoffeeRankModule {}
