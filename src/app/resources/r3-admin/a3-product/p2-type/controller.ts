// ===========================================================================>> Core Library
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from "@nestjs/common";

// ===========================================================================>> Custom Library

import { CreateProductTypeDto, UpdateProductTypeDto } from "./dto";
import { ProductTypeService } from "./service";

@Controller()
export class ProductTypeController {
  constructor(private _service: ProductTypeService) {}

  // =============================================>> Get Data or Read
  @Get()
  async getData() {
    // console.log("getData method called");
    return await this._service.getData();
  }

  // =============================================>> Create
  @Post()
  async create(@Body() body: CreateProductTypeDto) {
    return await this._service.create(body);
  }

  // =============================================>> Update
  @Put(":id")
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: UpdateProductTypeDto
  ) {
    return this._service.update(body, id);
  }

  // =============================================>> Delete
  @Delete(":id")
  async delete(@Param("id") id: number) {
    return await this._service.delete(id);
  }
}
