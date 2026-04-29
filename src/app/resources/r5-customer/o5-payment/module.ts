// ===========================================================================>> Core Library
import { Module, forwardRef } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { BarayModule } from 'src/app/payments/baray.module';
import { CustomerBarayPaymentController } from './customer-baray.controller';
import { CustomerPaymentController } from './controller';
import { CustomerPaymentService }    from './service';

@Module({
    imports    : [forwardRef(() => BarayModule)],
    controllers: [CustomerPaymentController, CustomerBarayPaymentController],
    providers  : [CustomerPaymentService],
})
export class CustomerPaymentModule {}
