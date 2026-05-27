import { Module } from '@nestjs/common';
import { RecipeCostingController } from './controller';
import { RecipeCostingService } from './service';

@Module({
    controllers: [RecipeCostingController],
    providers  : [RecipeCostingService],
})
export class RecipeCostingModule {}
