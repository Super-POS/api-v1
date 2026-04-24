// ===========================================================================>> Core Library
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { UserMiddleware } from '@app/core/middlewares/user.middleware';
import { OrderModule }    from './c1-order/module';
import { SaleModule }     from './c2-sale/module';
import { ManageModule }   from './c3-manage/module';
import { DeviceTrackerMiddleware } from '@app/core/middlewares/device-tracker.middleware';

@Module({
    imports: [
        SaleModule,
        OrderModule,
        ManageModule,
    ]
})

export class CashierModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(UserMiddleware, DeviceTrackerMiddleware)
            .forRoutes({ path: 'api/cashier/*', method: RequestMethod.ALL });
    }
}