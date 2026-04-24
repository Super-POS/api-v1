// ===========================================================================>> Core Library
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { CustomerMiddleware }  from '@app/core/middlewares/customer.middleware';
import { DeviceTrackerMiddleware } from '@app/core/middlewares/device-tracker.middleware';
import { CustomerOrderModule } from './o1-order/module';

@Module({
    imports: [CustomerOrderModule],
})
export class CustomerModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(CustomerMiddleware, DeviceTrackerMiddleware)
            .forRoutes({ path: 'api/customer/*', method: RequestMethod.ALL });
    }
}
