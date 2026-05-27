import { Module } from '@nestjs/common';
import { AnalyticsController } from './controller';
import { AnalyticsService } from './service';
import { ProfitService } from '@app/services/profit.service';
import { RecipeCostingService } from '../e4-recipe-costing/service';

@Module({
    controllers: [AnalyticsController],
    providers  : [AnalyticsService, ProfitService, RecipeCostingService],
})
export class AnalyticsModule {}
