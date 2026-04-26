// ===========================================================================>> Core Library
import { Routes } from '@nestjs/core';

// ===========================================================================>> Custom Library
import { DashboardModule }           from './a1-dashbord/module';
import { SaleModule }                from './a2-sale/module';
import { MenuModule }             from './a3-menu/p1-menu/module';
import { MenuTypeModule }         from './a3-menu/p2-category/module';
import { MenuIngredientModule }   from './a3-menu/p3-ingredient/module';
import { StockMovementModule }       from './a3-menu/p5-stock-movement/module';
import { UserModule }                from './a4-user/module';
import { AdminDepositModule }        from './a5-deposit/module';
import { AdminRewardModule }         from './a6-reward/module';
import { AdminPaymentModule }        from './a7-payment/module';
import { FinancialReportModule }     from './a8-report/module';

export const adminRoutes: Routes = [
    {
        path: 'dashboard',
        module: DashboardModule
    },

    {
        path: 'sales',
        module: SaleModule
    },

    {
        path: 'menus',
        module: MenuModule
    },

    {
        path: 'menu/categories',
        module: MenuTypeModule
    },

    {
        path: 'menu/ingredients',
        module: MenuIngredientModule
    },

    {
        path: 'menu/stock-movements',
        module: StockMovementModule
    },

    {
        path: 'users',
        module: UserModule
    },

    {
        path: 'deposits',
        module: AdminDepositModule
    },

    {
        path: 'rewards',
        module: AdminRewardModule
    },

    {
        path: 'payments',
        module: AdminPaymentModule,
    },
    {
        path: 'reports',
        module: FinancialReportModule,
    },
];