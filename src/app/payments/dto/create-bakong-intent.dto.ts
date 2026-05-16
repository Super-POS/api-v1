import { Type } from "class-transformer";
import { IsInt, IsPositive } from "class-validator";

export class CreateBakongIntentDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  order_id: number;
}
