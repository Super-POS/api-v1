import { Module } from '@nestjs/common';
import { PayrollController } from './controller';
import { PayrollService } from './service';

@Module({
    controllers: [PayrollController],
    providers  : [PayrollService],
})
export class PayrollModule {}
