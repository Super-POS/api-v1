// ===========================================================================>> Core Library
import { forwardRef, Module } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { CustomerWalletController } from './controller';
import { CustomerWalletService }    from './service';
import { BakongModule } from 'src/app/payments/bakong.module';
import { BarayModule } from 'src/app/payments/baray.module';

@Module({
    imports     : [forwardRef(() => BarayModule), forwardRef(() => BakongModule)],
    controllers: [CustomerWalletController],
    providers  : [CustomerWalletService],
})
export class CustomerWalletModule {}
