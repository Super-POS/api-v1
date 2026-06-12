// ===========================================================================>> Core Library
import { Module, forwardRef } from '@nestjs/common';

// ===========================================================================>> Custom Library
// Baray disabled: import { BarayModule } from 'src/app/payments/baray.module';
import { BakongModule } from 'src/app/payments/bakong.module';
import { CustomerBakongPaymentController } from './customer-bakong.controller';
// Baray disabled: import { CustomerBarayPaymentController } from './customer-baray.controller';
import { CustomerPaymentController } from './controller';
import { CustomerPaymentService }    from './service';

@Module({
    imports    : [forwardRef(() => BakongModule)], // Baray disabled: forwardRef(() => BarayModule),
    controllers: [CustomerPaymentController, CustomerBakongPaymentController], // CustomerBarayPaymentController
    providers  : [CustomerPaymentService],
})
export class CustomerPaymentModule {}
