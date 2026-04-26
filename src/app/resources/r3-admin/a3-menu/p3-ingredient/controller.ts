// ===========================================================================>> Core Library
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { CreateMenuIngredientDto, UpdateMenuIngredientDto } from './dto';
import { MenuIngredientService } from './service';

@Controller()
export class MenuIngredientController {

    constructor(private readonly _service: MenuIngredientService) {}

    // =============================================>> List
    @Get()
    async getData() {
        return await this._service.getData();
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
