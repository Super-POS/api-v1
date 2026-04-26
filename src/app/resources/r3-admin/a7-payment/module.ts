// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { AdminPaymentController } from './controller';
import { AdminPaymentService }    from './service';

@Module({
    controllers: [AdminPaymentController],
    providers  : [AdminPaymentService],
})
export class AdminPaymentModule {}
