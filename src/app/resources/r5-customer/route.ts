// ===========================================================================>> Core Library
import { Routes } from '@nestjs/core';

// ===========================================================================>> Custom Library
import { CustomerOrderModule } from './o1-order/module';

export const customerRoutes: Routes = [
    {
        path   : 'orders',
        module : CustomerOrderModule,
    },
];
