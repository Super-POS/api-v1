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
    @Query("page") page?: number | string,
    @Query("limit") limit?: number | string,
    @Query("page_size") pageSize?: number | string,
    @Query("key") key?: string,
    @Query("platform") platform?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("sort") sort?: "ordered_at" | "total_price",
    @Query("order") order?: "ASC" | "DESC"
  ) {
    // Set default values if not provided (Angular sends `page_size`, older clients may send `limit`)
    const toPositiveInt = (value: unknown, fallback: number): number => {
      const n = Number(value);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
    };
    const resolvedLimit = toPositiveInt(limit ?? pageSize, 10);
    const resolvedPage = toPositiveInt(page, 1);

    return await this._service.getData(
      auth.id,
      resolvedLimit,
      resolvedPage,
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