// ===========================================================================>> Core Library
import { Module, forwardRef } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { BakongModule } from 'src/app/payments/bakong.module';
import { BarayModule } from 'src/app/payments/baray.module';
import { CustomerBakongPaymentController } from './customer-bakong.controller';
import { CustomerBarayPaymentController } from './customer-baray.controller';
import { CustomerPaymentController } from './controller';
import { CustomerPaymentService }    from './service';

@Module({
    imports    : [forwardRef(() => BarayModule), forwardRef(() => BakongModule)],
    controllers: [CustomerPaymentController, CustomerBarayPaymentController, CustomerBakongPaymentController],
    providers  : [CustomerPaymentService],
})
export class CustomerPaymentModule {}
