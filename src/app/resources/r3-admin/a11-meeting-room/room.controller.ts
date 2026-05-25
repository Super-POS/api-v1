import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RolesDecorator }    from '@app/core/decorators/roles.decorator';
import { RoleGuard }         from '@app/core/guards/role.guard';
import { RoleEnum }          from '@app/enums/role.enum';
import { CreateRoomDto, UpdateRoomDto } from './room.dto';
import { AdminRoomService }  from './room.service';

@Controller()
@UseGuards(RoleGuard)
@RolesDecorator(RoleEnum.ADMIN)
export class AdminRoomController {
    constructor(private readonly _service: AdminRoomService) {}

    @Get()
    list() {
        return this._service.list();
    }

    @Post()
    create(@Body() body: CreateRoomDto) {
        return this._service.create(body);
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this._service.findOne(id);
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateRoomDto) {
        return this._service.update(id, body);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this._service.remove(id);
    }

    /** GET /api/admin/meeting-rooms/:id/availability?check_in=2025-06-01&check_out=2025-06-01 */
    @Get(':id/availability')
    availability(
        @Param('id', ParseIntPipe) id: number,
        @Query('check_in')  checkIn:  string,
        @Query('check_out') checkOut: string,
    ) {
        return this._service.availability(id, checkIn, checkOut);
    }
}
