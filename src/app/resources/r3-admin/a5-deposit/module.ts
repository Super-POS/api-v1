// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { AdminDepositController } from './controller';
import { AdminDepositService }    from './service';

@Module({
    controllers: [AdminDepositController],
    providers  : [AdminDepositService],
})
export class AdminDepositModule {}
