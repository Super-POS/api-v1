import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PublicMeetingRoomService } from './service';
import { CreatePublicBookingDto } from './dto';

@Controller()
export class PublicMeetingRoomController {
    constructor(private readonly _service: PublicMeetingRoomService) {}

    /** GET /api/share/meeting-rooms — list all rooms with AVAILABLE status */
    @Get()
    listAvailable() {
        return this._service.listAvailable();
    }

    /** GET /api/share/meeting-rooms/availability?check_in=2025-06-01&check_out=2025-06-01
     *  Returns each room annotated with `is_available: true/false`.
     */
    @Get('availability')
    checkAvailability(
        @Query('check_in')  checkIn:  string,
        @Query('check_out') checkOut: string,
    ) {
        return this._service.checkAvailability(checkIn, checkOut);
    }

    /** POST /api/share/meeting-rooms/bookings — submit booking without login */
    @Post('bookings')
    createPublicBooking(@Body() body: CreatePublicBookingDto) {
        return this._service.createPublicBooking(body);
    }
}
