import { Module }                  from '@nestjs/common';
import { CustomerBookingController } from './controller';
import { CustomerBookingService }    from './service';

@Module({
    controllers: [CustomerBookingController],
    providers  : [CustomerBookingService],
})
export class CustomerMeetingRoomBookingModule {}
