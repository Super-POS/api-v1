// ===========================================================================>> Core Library
import { InvoiceModule } from './invoice/invoice.module';

// ===========================================================================>> Custom Library
import { Routes } from '@nestjs/core';
import { NotificationGetwayModule } from './notification-getway/notifications.gateway.module';
import { NotificationModule } from './notification/notification.module';
import { ReportModule } from './report/module';
import { PublicMenuModule } from './public-menu/public-menu.module';
import { PublicExchangeModule }    from './public-exchange/public-exchange.module';
import { PublicMeetingRoomModule } from './public-meeting-room/module';

export const utilsRoutes: Routes = [
    {
        path   : 'menus',
        module : PublicMenuModule,
    },
    {
        path   : 'exchange-rate',
        module : PublicExchangeModule,
    },
    {
        path: 'print',
        module: InvoiceModule
    },
    {
        path: 'notifications',
        module: NotificationModule
    },
    {
        path: 'notifications-getway',
        module: NotificationGetwayModule
    },
    {
        path: 'report',
        module: ReportModule
    },
    {
        path  : 'meeting-rooms',
        module: PublicMeetingRoomModule,
    },
];