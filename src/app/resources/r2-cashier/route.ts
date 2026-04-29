// ===========================================================================>> Core Library
import { Routes } from '@nestjs/core';

// ===========================================================================>> Custom Library
import { OrderModule }  from './c1-order/module';
import { SaleModule }   from './c2-sale/module';
import { ManageModule }            from './c3-manage/module';
import { CashierCashDrawerModule } from './c4-cash-drawer/module';

export const cashierRoutes: Routes = [
    {
        path   : 'ordering',
        module : OrderModule,
    },
    {
        path   : 'sales',
        module : SaleModule,
    },
    {
        path   : 'orders',
        module : ManageModule,
    },

    {
        path  : 'cash-drawer',
        module: CashierCashDrawerModule,
    },
];