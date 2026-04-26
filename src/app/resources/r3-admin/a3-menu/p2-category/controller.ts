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

import { CreateMenuTypeDto, UpdateMenuTypeDto } from "./dto";
import { MenuTypeService } from "./service";

@Controller()
export class MenuTypeController {
  constructor(private _service: MenuTypeService) {}

  // =============================================>> Get Data or Read
  @Get()
  async getData() {
    // console.log("getData method called");
    return await this._service.getData();
  }

  // =============================================>> Create
  @Post()
  async create(@Body() body: CreateMenuTypeDto) {
    return await this._service.create(body);
  }

  // =============================================>> Update
  @Put(":id")
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: UpdateMenuTypeDto
  ) {
    return this._service.update(body, id);
  }

  // =============================================>> Delete
  @Delete(":id")
  async delete(@Param("id") id: number) {
    return await this._service.delete(id);
  }
}
