// ===========================================================================>> Core Library
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';

// ============================================================================>> Custom Library
import { AdminMiddleware } from '@app/core/middlewares/admin.middleware';
import { DeviceTrackerMiddleware } from '@app/core/middlewares/device-tracker.middleware';
import { DashboardModule } from './a1-dashbord/module';
import { ProductModule } from './a3-menu/p1-menu/module';
import { ProductTypeModule } from './a3-menu/p2-category/module';
import { ProductIngredientModule } from './a3-menu/p3-ingredient/module';
import { SaleModule } from './a2-sale/module';
import { UserModule } from './a4-user/module';

// ======================================= >> Code Starts Here << ========================== //
@Module({
    imports: [
        DashboardModule,
        SaleModule,
        ProductModule,
        ProductTypeModule,
        ProductIngredientModule,
        UserModule
    ]
})

export class AdminModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(AdminMiddleware, DeviceTrackerMiddleware)
            .forRoutes({ path: 'api/admin/*', method: RequestMethod.ALL });
    }
}