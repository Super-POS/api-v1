// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { ProductRecipeController } from './controller';
import { ProductRecipeService } from './service';

@Module({
    controllers: [ProductRecipeController],
    providers: [ProductRecipeService],
})
export class ProductRecipeModule {}
