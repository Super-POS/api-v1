import { Routes } from '@nestjs/core';
import { PayrollModule }        from './e1-payroll/module';
import { PurchasingModule }     from './e2-purchasing/module';
import { PLModule }             from './e3-pl/module';
import { RecipeCostingModule }  from './e4-recipe-costing/module';
import { AnalyticsModule }      from './e5-analytics/module';

export const superUserRoutes: Routes = [
    {
        path  : 'payroll',
        module: PayrollModule,
    },
    {
        path  : 'purchasing',
        module: PurchasingModule,
    },
    {
        path  : 'pl',
        module: PLModule,
    },
    {
        path  : 'recipe-costing',
        module: RecipeCostingModule,
    },
    {
        path  : 'analytics',
        module: AnalyticsModule,
    },
];
