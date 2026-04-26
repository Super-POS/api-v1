// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { MenuIngredientController } from './controller';
import { MenuIngredientService } from './service';

@Module({
    controllers: [MenuIngredientController],
    providers: [MenuIngredientService],
})
export class MenuIngredientModule {}
