import { Module } from '@nestjs/common';
// Baray disabled: import { forwardRef, Module } from '@nestjs/common';
// Baray disabled: import { BarayModule } from 'src/app/payments/baray.module';
import { CustomerBookingController } from './controller';
import { CustomerBookingService }    from './service';

@Module({
    // Baray disabled: imports: [forwardRef(() => BarayModule)],
    controllers: [CustomerBookingController],
    providers  : [CustomerBookingService],
})
export class CustomerMeetingRoomBookingModule {}
