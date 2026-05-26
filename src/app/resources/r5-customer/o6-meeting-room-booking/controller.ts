import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import UserDecorator             from '@app/core/decorators/user.decorator';
import User                      from '@app/models/user/user.model';
import { CustomerBookingService } from './service';
import { CreateBookingDto }       from './dto';
import { BarayService } from '@app/services/baray.service';

@Controller()
export class CustomerBookingController {
    constructor(
        private readonly _service: CustomerBookingService,
        private readonly _baray: BarayService,
    ) {}

    /** GET /api/customer/meeting-room-bookings */
    @Get()
    list(@UserDecorator() user: User) {
        return this._service.list(user.id);
    }

    /** GET /api/customer/meeting-room-bookings/:id */
    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number, @UserDecorator() user: User) {
        return this._service.findOne(id, user.id);
    }

    /** POST /api/customer/meeting-room-bookings */
    @Post()
    create(@Body() body: CreateBookingDto, @UserDecorator() user: User) {
        return this._service.create(body, user.id);
    }

    /** POST /api/customer/meeting-room-bookings/:id/baray/intent */
    @Post(':id/baray/intent')
    createBarayIntent(@Param('id', ParseIntPipe) id: number, @UserDecorator() user: User) {
        return this._baray.createIntentForCustomerMeetingRoomBooking(user.id, id);
    }

    /** GET /api/customer/meeting-room-bookings/:id/payment-state */
    @Get(':id/payment-state')
    paymentState(@Param('id', ParseIntPipe) id: number, @UserDecorator() user: User) {
        return this._baray.getCustomerMeetingRoomBookingPaymentState(user.id, id);
    }

    /** PATCH /api/customer/meeting-room-bookings/:id/cancel */
    @Patch(':id/cancel')
    cancel(@Param('id', ParseIntPipe) id: number, @UserDecorator() user: User) {
        return this._service.cancel(id, user.id);
    }
}
