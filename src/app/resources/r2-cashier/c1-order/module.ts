// =========================================================================>> Core Library
import { forwardRef, Module } from '@nestjs/common';

// =========================================================================>> Custom Library
import { BarayModule } from 'src/app/payments/baray.module';
import { BakongModule } from 'src/app/payments/bakong.module';
import { NotificationsGateway } from '@app/utils/notification-getway/notifications.gateway';
import { TelegramService } from 'src/app/services/telegram.service';
import { BarayPaymentController } from './baray-payment.controller';
import { BakongPaymentController } from './bakong-payment.controller';
import { QrTablePaymentController, QrTablePaymentService } from './qr-table-payment.controller';
import { OrderController } from './controller';
import { OrderService } from './service';

// ======================================= >> Code Starts Here << ========================== //
@Module({
    imports: [forwardRef(() => BarayModule), forwardRef(() => BakongModule)],
    controllers: [OrderController, BarayPaymentController, BakongPaymentController, QrTablePaymentController],
    providers: [OrderService, TelegramService, NotificationsGateway, QrTablePaymentService],
    exports: [OrderService],
})
export class OrderModule { }
