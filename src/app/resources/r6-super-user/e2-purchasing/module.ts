import { Module } from '@nestjs/common';
import { PurchasingController } from './controller';
import { PurchasingService } from './service';

@Module({
    controllers: [PurchasingController],
    providers  : [PurchasingService],
})
export class PurchasingModule {}
