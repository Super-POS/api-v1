// =========================================================================>> Core Library
import { forwardRef, Module } from '@nestjs/common';

// =========================================================================>> Custom Library
// Baray disabled: import { BarayModule } from 'src/app/payments/baray.module';
import { BakongModule } from 'src/app/payments/bakong.module';
import { PaywayModule } from 'src/app/payments/payway.module';
import { NotificationsGateway } from '@app/utils/notification-getway/notifications.gateway';
import { TelegramService } from 'src/app/services/telegram.service';
// Baray disabled: import { BarayPaymentController } from './baray-payment.controller';
import { AbaPaymentController } from './aba-payment.controller';
import { BakongPaymentController } from './bakong-payment.controller';
import { QrTablePaymentController, QrTablePaymentService } from './qr-table-payment.controller';
import { OrderController } from './controller';
import { OrderService } from './service';

// ======================================= >> Code Starts Here << ========================== //
@Module({
    imports: [forwardRef(() => BakongModule), forwardRef(() => PaywayModule)],
    controllers: [OrderController, BakongPaymentController, AbaPaymentController, QrTablePaymentController],
    providers: [OrderService, TelegramService, NotificationsGateway, QrTablePaymentService],
    exports: [OrderService],
})
export class OrderModule { }
