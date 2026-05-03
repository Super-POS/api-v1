import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { RolesDecorator } from '@app/core/decorators/roles.decorator';
import { RoleGuard } from '@app/core/guards/role.guard';
import { RoleEnum } from '@app/enums/role.enum';
import { CreateCouponDto, UpdateCouponDto } from './dto';
import { AdminCouponService } from './service';

@Controller()
@UseGuards(RoleGuard)
@RolesDecorator(RoleEnum.ADMIN)
export class AdminCouponController {
    constructor(private readonly _service: AdminCouponService) {}

    @Get()
    async list() {
        return await this._service.list();
    }

    @Post()
    async create(@Body() body: CreateCouponDto) {
        return await this._service.create(body);
    }

    @Patch(':id')
    async update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateCouponDto) {
        return await this._service.update(id, body);
    }

    @Delete(':id')
    async remove(@Param('id', ParseIntPipe) id: number) {
        return await this._service.remove(id);
    }
}
