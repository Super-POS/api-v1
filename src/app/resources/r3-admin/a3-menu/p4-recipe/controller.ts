// ===========================================================================>> Core Library
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { CreateProductRecipeDto, UpdateProductRecipeDto } from './dto';
import { ProductRecipeService } from './service';

@Controller()
export class ProductRecipeController {

    constructor(private readonly _service: ProductRecipeService) {}

    // =============================================>> List (optional ?product_id=)
    @Get()
    async getData(@Query('product_id') product_id?: string) {
        return await this._service.getData(product_id ? parseInt(product_id, 10) : undefined);
    }

    // =============================================>> View One
    @Get(':id')
    async view(@Param('id', ParseIntPipe) id: number) {
        return await this._service.view(id);
    }

    // =============================================>> Create
    @Post()
    async create(@Body() body: CreateProductRecipeDto) {
        return await this._service.create(body);
    }

    // =============================================>> Update
    @Put(':id')
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: UpdateProductRecipeDto
    ) {
        return await this._service.update(body, id);
    }

    // =============================================>> Delete
    @Delete(':id')
    async delete(@Param('id', ParseIntPipe) id: number) {
        return await this._service.delete(id);
    }
}
