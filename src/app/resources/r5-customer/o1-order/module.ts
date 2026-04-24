// =========================================================================>> Core Library
import { Module } from '@nestjs/common';

// =========================================================================>> Custom Library
import { CustomerOrderController } from './controller';
import { CustomerOrderService }    from './service';

@Module({
    controllers : [CustomerOrderController],
    providers   : [CustomerOrderService],
})
export class CustomerOrderModule {}
