import { Type } from "class-transformer";
import { IsInt, IsPositive } from "class-validator";

/** JSON body often sends order_id as a string; coerce before @IsInt() or Nest returns 400. */
export class CreateBarayIntentDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  order_id: number;
}
