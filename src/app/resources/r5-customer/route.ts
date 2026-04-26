// ===========================================================================>> Core Library
import { Routes } from '@nestjs/core';

// ===========================================================================>> Custom Library
import { CustomerOrderModule }   from './o1-order/module';
import { CustomerWalletModule }  from './o2-wallet/module';
import { CustomerRewardModule }  from './o3-reward/module';
import { CustomerProfileModule } from './o4-profile/module';

export const customerRoutes: Routes = [
    {
        path  : 'orders',
        module: CustomerOrderModule,
    },
    {
        path  : 'wallet',
        module: CustomerWalletModule,
    },
    {
        path  : 'rewards',
        module: CustomerRewardModule,
    },
    {
        path  : 'profile',
        module: CustomerProfileModule,
    },
];
