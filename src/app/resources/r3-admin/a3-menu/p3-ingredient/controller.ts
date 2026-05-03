// ===========================================================================>> Core Library
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { CreateMenuIngredientDto, RestockMenuIngredientDto, UpdateMenuIngredientDto } from './dto';
import { MenuIngredientService } from './service';

@Controller()
export class MenuIngredientController {

    constructor(private readonly _service: MenuIngredientService) {}

    // =============================================>> List
    @Get()
    async getData() {
        return await this._service.getData();
    }

    // =============================================>> Restock (must be before :id)
    @Get('restock/list')
    async restockList() {
        return await this._service.getRestockList();
    }

    // =============================================>> View One
    @Get(':id')
    async view(@Param('id', ParseIntPipe) id: number) {
        return await this._service.view(id);
    }

    // =============================================>> Create
    @Post()
    async create(@Body() body: CreateMenuIngredientDto) {
        return await this._service.create(body);
    }

    // =============================================>> Restock (increment quantity; must be before generic :id routes that could collide)
    @Post(':id/restock')
    async restock(@Param('id', ParseIntPipe) id: number, @Body() body: RestockMenuIngredientDto) {
        return await this._service.restock(id, body);
    }

    // =============================================>> Update
    @Put(':id')
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: UpdateMenuIngredientDto
    ) {
        return await this._service.update(body, id);
    }

    // =============================================>> Delete
    @Delete(':id')
    async delete(@Param('id', ParseIntPipe) id: number) {
        return await this._service.delete(id);
    }
}
