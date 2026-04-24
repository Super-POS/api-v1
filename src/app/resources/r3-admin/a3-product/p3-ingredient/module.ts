import { Module } from '@nestjs/common';
import { IngredientController } from './controller';
import { IngredientService } from './service';

@Module({
  controllers: [IngredientController],
  providers: [IngredientService],
})
export class IngredientModule {}
