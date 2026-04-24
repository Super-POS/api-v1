// ===========================================================================>> Core Library
import { Routes } from '@nestjs/core';

// ===========================================================================>> Custom Library
import { DashboardModule }      from './a1-dashbord/module';
import { SaleModule }           from './a2-sale/module';
import { ProductModule }        from './a3-product/p1-product/module';
import { ProductTypeModule }    from './a3-product/p2-type/module';
import { IngredientModule }     from './a3-product/p3-ingredient/module';
import { UserModule }           from './a4-user/module';

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
        path: 'products',
        module: ProductModule
    },

    {
        path: 'product/types',
        module: ProductTypeModule
    },

    {
        path: 'ingredients',
        module: IngredientModule
    },

    {
        path: 'users',
        module: UserModule
    },
];