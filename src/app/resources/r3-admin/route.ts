// ===========================================================================>> Core Library
import { Routes } from '@nestjs/core';

// ===========================================================================>> Custom Library
import { DashboardModule }           from './a1-dashbord/module';
import { SaleModule }                from './a2-sale/module';
import { ProductModule }             from './a3-menu/p1-menu/module';
import { ProductTypeModule }         from './a3-menu/p2-category/module';
import { ProductIngredientModule }   from './a3-menu/p3-ingredient/module';
import { ProductRecipeModule }       from './a3-menu/p4-recipe/module';
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
        module: ProductModule
    },

    {
        path: 'menu/categories',
        module: ProductTypeModule
    },

    {
        path: 'menu/ingredients',
        module: ProductIngredientModule
    },

    {
        path: 'menu/recipes',
        module: ProductRecipeModule
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