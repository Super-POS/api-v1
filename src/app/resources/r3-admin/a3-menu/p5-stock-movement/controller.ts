// ===========================================================================>> Core Library
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { CreateStockMovementDto } from './dto';
import { StockMovementService } from './service';

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

    // =============================================>> Create
    @Post()
    async create(@Body() body: CreateStockMovementDto) {
        return await this._service.create(body);
    }

    // =============================================>> Delete (reverses the quantity change)
    @Delete(':id')
    async delete(@Param('id', ParseIntPipe) id: number) {
        return await this._service.delete(id);
    }
}
