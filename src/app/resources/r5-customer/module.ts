// ===========================================================================>> Core Library
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { CustomerMiddleware }  from '@app/core/middlewares/customer.middleware';
import { DeviceTrackerMiddleware } from '@app/core/middlewares/device-tracker.middleware';
import { CustomerOrderModule }   from './o1-order/module';
import { CustomerWalletModule }  from './o2-wallet/module';
import { CustomerRewardModule }  from './o3-reward/module';
import { CustomerProfileModule } from './o4-profile/module';
import { CustomerPaymentModule } from './o5-payment/module';

@Module({
    imports: [CustomerOrderModule, CustomerWalletModule, CustomerRewardModule, CustomerProfileModule, CustomerPaymentModule],
})
export class CustomerModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(CustomerMiddleware, DeviceTrackerMiddleware)
            .forRoutes({ path: 'api/customer/*', method: RequestMethod.ALL });
    }
}
