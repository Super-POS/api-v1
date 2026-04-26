// ===========================================================================>> Core Library
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { RolesDecorator }           from '@app/core/decorators/roles.decorator';
import { RoleGuard }                from '@app/core/guards/role.guard';
import { RoleEnum }                 from '@app/enums/role.enum';
import UserDecorator                from '@app/core/decorators/user.decorator';
import User                         from '@app/models/user/user.model';
import { CreateStockMovementDto }   from './dto';
import { StockMovementService }     from './service';

@Controller()
export class StockMovementController {

    constructor(private readonly _service: StockMovementService) {}

    // =============================================>> List (optional ?ingredient_id=)
    @Get()
    async getData(@Query('ingredient_id') ingredient_id?: string) {
        return await this._service.getData(ingredient_id ? parseInt(ingredient_id, 10) : undefined);
    }

    // =============================================>> View One
    @Get(':id')
    async view(@Param('id', ParseIntPipe) id: number) {
        return await this._service.view(id);
    }

    // =============================================>> Create (ADMIN only — audited)
    @Post()
    @UseGuards(RoleGuard)
    @RolesDecorator(RoleEnum.ADMIN)
    async create(@Body() body: CreateStockMovementDto, @UserDecorator() user: User) {
        return await this._service.create(body, user.id);
    }

    // =============================================>> Delete (ADMIN only — reverses the quantity change)
    @Delete(':id')
    @UseGuards(RoleGuard)
    @RolesDecorator(RoleEnum.ADMIN)
    async delete(@Param('id', ParseIntPipe) id: number) {
        return await this._service.delete(id);
    }
}
