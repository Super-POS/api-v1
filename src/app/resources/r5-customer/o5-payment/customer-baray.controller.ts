// ===========================================================================>> Core Library
import { Body, Controller, Get, Param, ParseIntPipe, Post } from "@nestjs/common";

// ===========================================================================>> Custom Library
import UserDecorator from "@app/core/decorators/user.decorator";
import User from "@app/models/user/user.model";
import { CreateBarayIntentDto } from "src/app/payments/dto/create-baray-intent.dto";
import { BarayService } from "src/app/services/baray.service";

/** Baray QR / bank link — mirrors cashier `ordering/baray/*` but scoped to order owner. */
@Controller("baray")
export class CustomerBarayPaymentController {
  constructor(private readonly _baray: BarayService) {}

  @Post("intent")
  async createIntent(@Body() body: CreateBarayIntentDto, @UserDecorator() user: User) {
    const data = await this._baray.createIntentForCustomerOrder(user.id, body.order_id);
    return {
      data,
      message: "Open the pay URL to complete payment with Baray (QR).",
    };
  }

  /** Poll while customer completes payment (same payload shape as cashier POS). */
  @Get("order/:id/payment-state")
  async paymentState(@Param("id", ParseIntPipe) id: number, @UserDecorator() user: User) {
    await this._baray.assertCustomerOwnsOrder(user.id, id);
    return await this._baray.getPaymentStateForPos(id);
  }
}
