// ===========================================================================>> Core Library
import { Body, Controller, Get, Param, ParseIntPipe, Post } from "@nestjs/common";

// ===========================================================================>> Custom Library
import UserDecorator from "@app/core/decorators/user.decorator";
import User from "@app/models/user/user.model";
import { BakongService } from "src/app/services/bakong.service";
import { CreateBakongIntentDto } from "src/app/payments/dto/create-bakong-intent.dto";

/** Bakong (KHQR) payment for an order — under api/cashier/ordering/bakong/... */
@Controller("bakong")
export class BakongPaymentController {
  constructor(private readonly _bakong: BakongService) {}

  @Post("payment-intent")
  async createIntent(
    @Body() body: CreateBakongIntentDto,
    @UserDecorator() user: User,
  ) {
    const data = await this._bakong.createIntentForCashierOrder(
      user.id,
      body.order_id,
    );
    return { data, message: "Display the QR code for the customer to scan." };
  }

  /** Lightweight poll while cashier waits — reads order status + checks Bakong API for transaction. */
  @Get("order/:id/payment-state")
  async paymentState(@Param("id", ParseIntPipe) id: number) {
    return await this._bakong.getPaymentStateForPos(id);
  }
}
