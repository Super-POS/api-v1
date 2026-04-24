import { Body, Controller, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { IngredientService } from './service';
import { CreateIngredientDto, UpdateIngredientDto } from './dto';

@Controller()
export class IngredientController {
  constructor(private _service: IngredientService) {}

  @Get()
  async list() {
    return await this._service.list();
  }

  @Post()
  async create(@Body() body: CreateIngredientDto) {
    return await this._service.create(body);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateIngredientDto,
  ) {
    return await this._service.update(id, body);
  }
}
