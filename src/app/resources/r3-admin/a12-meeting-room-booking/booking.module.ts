import { Module }                from '@nestjs/common';
import { AdminBookingController } from './booking.controller';
import { AdminBookingService }    from './booking.service';
import { GoogleCalendarService }  from '@app/services/google-calendar.service';

@Module({
    controllers: [AdminBookingController],
    providers  : [AdminBookingService, GoogleCalendarService],
})
export class AdminMeetingRoomBookingModule {}
