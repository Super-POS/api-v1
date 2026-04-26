// ===========================================================================>> Core Library
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';

// ============================================================================>> Custom Library
import { AdminMiddleware } from '@app/core/middlewares/admin.middleware';
import { DeviceTrackerMiddleware } from '@app/core/middlewares/device-tracker.middleware';
import { DashboardModule } from './a1-dashbord/module';
import { MenuModule } from './a3-menu/p1-menu/module';
import { MenuTypeModule } from './a3-menu/p2-category/module';
import { MenuIngredientModule } from './a3-menu/p3-ingredient/module';
import { StockMovementModule } from './a3-menu/p5-stock-movement/module';
import { SaleModule } from './a2-sale/module';
import { UserModule }         from './a4-user/module';
import { AdminDepositModule }  from './a5-deposit/module';
import { AdminRewardModule }   from './a6-reward/module';
import { AdminPaymentModule }  from './a7-payment/module';
import { FinancialReportModule } from './a8-report/module';

// ======================================= >> Code Starts Here << ========================== //
@Module({
    imports: [
        DashboardModule,
        SaleModule,
        MenuModule,
        MenuTypeModule,
        MenuIngredientModule,
        StockMovementModule,
        UserModule,
        AdminDepositModule,
        AdminRewardModule,
        AdminPaymentModule,
        FinancialReportModule,
    ]
})

export class AdminModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(AdminMiddleware, DeviceTrackerMiddleware)
            .forRoutes({ path: 'api/admin/*', method: RequestMethod.ALL });
    }
}