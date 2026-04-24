// ===========================================================================>> Core Library
import { Routes } from '@nestjs/core';

// ===========================================================================>> Custom Library
import { DashboardModule }           from './a1-dashbord/module';
import { SaleModule }                from './a2-sale/module';
import { ProductModule }             from './a3-menu/p1-menu/module';
import { ProductTypeModule }         from './a3-menu/p2-category/module';
import { ProductIngredientModule }   from './a3-menu/p3-ingredient/module';
import { UserModule }                from './a4-user/module';

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
        path: 'users',
        module: UserModule
    },
];