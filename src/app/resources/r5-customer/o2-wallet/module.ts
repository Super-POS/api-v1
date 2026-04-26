// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { CustomerWalletController } from './controller';
import { CustomerWalletService }    from './service';

@Module({
    controllers: [CustomerWalletController],
    providers  : [CustomerWalletService],
})
export class CustomerWalletModule {}
