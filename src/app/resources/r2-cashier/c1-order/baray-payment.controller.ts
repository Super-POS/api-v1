// ===========================================================================>> Core Library
import { Body, Controller, Get, Param, ParseIntPipe, Post } from "@nestjs/common";

// ===========================================================================>> Custom Library
import UserDecorator from "@app/core/decorators/user.decorator";
import User from "@app/models/user/user.model";
import { CreateBarayIntentDto } from "src/app/payments/dto/create-baray-intent.dto";
import { BarayService } from "src/app/services/baray.service";

/** Baray (local bank) pay link for an order — under api/cashier/ordering/baray/... */
@Controller("baray")
export class BarayPaymentController {
  constructor(private readonly _baray: BarayService) {}

  @Post("payment-intent")
  async createIntent(
    @Body() body: CreateBarayIntentDto,
    @UserDecorator() user: User,
  ) {
    const data = await this._baray.createIntentForCashierOrder(
      user.id,
      body.order_id,
    );
    return { data, message: "Open the pay URL to complete the bank transfer." };
  }

  /** Lightweight poll while cashier waits — reads `order.status` + latest Baray `payment_transaction` row. */
  @Get("order/:id/payment-state")
  async paymentState(@Param("id", ParseIntPipe) id: number) {
    return await this._baray.getPaymentStateForPos(id);
  }
}
