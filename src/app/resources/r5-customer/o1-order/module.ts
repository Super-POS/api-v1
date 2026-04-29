// =========================================================================>> Core Library
import { Module } from '@nestjs/common';

// =========================================================================>> Custom Library
import { CustomerOrderController } from './controller';
import { CustomerOrderService }    from './service';
import { TelegramService } from '@app/services/telegram.service';

@Module({
    controllers : [CustomerOrderController],
    providers   : [CustomerOrderService, TelegramService],
    exports     : [CustomerOrderService],
})
export class CustomerOrderModule {}
