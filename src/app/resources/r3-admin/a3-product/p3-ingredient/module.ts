// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { ProductIngredientController } from './controller';
import { ProductIngredientService } from './service';

@Module({
    controllers: [ProductIngredientController],
    providers: [ProductIngredientService],
})
export class ProductIngredientModule {}
