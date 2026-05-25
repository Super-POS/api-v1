// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { InvoiceModule } from './invoice/invoice.module';
import { NotificationGetwayModule } from './notification-getway/notifications.gateway.module';
import { NotificationModule } from './notification/notification.module';
import { ReportModule } from './report/module';
import { PublicMenuModule } from './public-menu/public-menu.module';
import { PublicExchangeModule }    from './public-exchange/public-exchange.module';
import { PublicMeetingRoomModule } from './public-meeting-room/module';


@Module({
    imports: [
        PublicMenuModule,
        PublicExchangeModule,
        InvoiceModule,
        NotificationModule,
        NotificationGetwayModule,
        ReportModule,
        PublicMeetingRoomModule,
    ]
})

export class UtilsModule {}