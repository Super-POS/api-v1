// =========================================================================>> Core Library
import { forwardRef, Module } from '@nestjs/common';

// =========================================================================>> Custom Library
import { BarayModule } from 'src/app/payments/baray.module';
import { NotificationsGateway } from '@app/utils/notification-getway/notifications.gateway';
import { TelegramService } from 'src/app/services/telegram.service';
import { BarayPaymentController } from './baray-payment.controller';
import { OrderController } from './controller';
import { OrderService } from './service';

// ======================================= >> Code Starts Here << ========================== //
@Module({
    imports: [forwardRef(() => BarayModule)],
    controllers: [OrderController, BarayPaymentController],
    providers: [OrderService, TelegramService, NotificationsGateway],
    exports: [OrderService],
})
export class OrderModule { }
