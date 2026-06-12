import { Type } from "class-transformer";
import { IsIn, IsInt, IsPositive } from "class-validator";

export class CreatePaywayIntentDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  order_id: number;

  @IsIn(["abapay_khqr", "wechat", "alipay"])
  payment_option: "abapay_khqr" | "wechat" | "alipay";
}
