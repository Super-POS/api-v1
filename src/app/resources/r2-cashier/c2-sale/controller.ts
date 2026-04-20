// ===========================================================================>> Core Library
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
} from "@nestjs/common";

// ===========================================================================>> Custom Library
import UserDecorator from "@app/core/decorators/user.decorator";
import User from "@app/models/user/user.model";
import { SaleService } from "./service";

@Controller()
export class SaleController {
  constructor(private readonly _service: SaleService) {}

  @Get("/setup")
  async getUser() {
    return await this._service.getUser();
  }

  @Get()
  async getAllSale(
    @UserDecorator() auth: User,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("key") key?: string,
    @Query("platform") platform?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("sort") sort?: "ordered_at" | "total_price",
    @Query("order") order?: "ASC" | "DESC"
  ) {
    // Set default values if not provided
    page = !page ? 1 : page;
    limit = !limit ? 10 : limit;

    return await this._service.getData(
      auth.id,
      limit,
      page,
      key,
      platform,
      startDate,
      endDate,
      sort,
      order
    );
  }

  @Get(":id/view")
  async view(@Param("id") id: number) {
    return await this._service.view(id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async delete(@Param("id") id: number): Promise<{ message: string }> {
    return await this._service.delete(id);
  }
}