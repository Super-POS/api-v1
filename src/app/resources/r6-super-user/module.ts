import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { DeviceTrackerMiddleware } from '@app/core/middlewares/device-tracker.middleware';
import { SuperUserMiddleware }    from '@app/core/middlewares/super-user.middleware';
import { PayrollModule }          from './e1-payroll/module';
import { PurchasingModule }       from './e2-purchasing/module';
import { PLModule }               from './e3-pl/module';
import { RecipeCostingModule }    from './e4-recipe-costing/module';
import { AnalyticsModule }        from './e5-analytics/module';

@Module({
    imports: [
        PayrollModule,
        PurchasingModule,
        PLModule,
        RecipeCostingModule,
        AnalyticsModule,
    ],
})
export class SuperUserModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(SuperUserMiddleware, DeviceTrackerMiddleware)
            .forRoutes({ path: 'api/erp/*', method: RequestMethod.ALL });
    }
}
