import { forwardRef, Module } from '@nestjs/common';
import { BarayModule } from 'src/app/payments/baray.module';
import { CustomerBookingController } from './controller';
import { CustomerBookingService }    from './service';

@Module({
    imports    : [forwardRef(() => BarayModule)],
    controllers: [CustomerBookingController],
    providers  : [CustomerBookingService],
})
export class CustomerMeetingRoomBookingModule {}
