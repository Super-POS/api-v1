// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { CustomerPaymentController } from './controller';
import { CustomerPaymentService }    from './service';

@Module({
    controllers: [CustomerPaymentController],
    providers  : [CustomerPaymentService],
})
export class CustomerPaymentModule {}
