import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { IsEnum }              from 'class-validator';
import { RolesDecorator }      from '@app/core/decorators/roles.decorator';
import { RoleGuard }           from '@app/core/guards/role.guard';
import { RoleEnum }            from '@app/enums/role.enum';
import { BookingStatusEnum }   from '@app/enums/booking-status.enum';
import { AdminBookingService } from './booking.service';

class UpdateStatusDto {
    @IsEnum(BookingStatusEnum) status: BookingStatusEnum;
}

@Controller()
@UseGuards(RoleGuard)
@RolesDecorator(RoleEnum.ADMIN, RoleEnum.CASHIER)
export class AdminBookingController {
    constructor(private readonly _service: AdminBookingService) {}

    /** GET /api/admin/meeting-room-bookings?status=pending */
    @Get()
    list(@Query('status') status?: BookingStatusEnum) {
        return this._service.list(status);
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this._service.findOne(id);
    }

    /** PATCH /api/admin/meeting-room-bookings/:id/status — { "status": "confirmed" } */
    @Patch(':id/status')
    updateStatus(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: UpdateStatusDto,
    ) {
        return this._service.updateStatus(id, body.status);
    }

    /** PATCH /api/admin/meeting-room-bookings/:id/mark-paid — cashier cash / in-person payment */
    @Patch(':id/mark-paid')
    markPaid(@Param('id', ParseIntPipe) id: number) {
        return this._service.markPaid(id);
    }
}
