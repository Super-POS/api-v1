// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { StockMovementController } from './controller';
import { StockMovementService } from './service';

@Module({
    controllers: [StockMovementController],
    providers: [StockMovementService],
})
export class StockMovementModule {}
