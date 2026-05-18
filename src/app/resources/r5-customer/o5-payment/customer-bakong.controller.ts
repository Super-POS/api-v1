// ===========================================================================>> Core Library
import { Body, Controller, Get, Param, ParseIntPipe, Post } from "@nestjs/common";

// ===========================================================================>> Custom Library
import UserDecorator from "@app/core/decorators/user.decorator";
import User from "@app/models/user/user.model";
import { BakongService } from "src/app/services/bakong.service";
import { CreateBakongIntentDto } from "src/app/payments/dto/create-bakong-intent.dto";

/**
 * Bakong KHQR payments for customers (web + Telegram Mini App). Mirrors the cashier flow at
 * `cashier/ordering/bakong/*` but scopes everything to the order owner.
 *
 * Mounted at `/api/customer/payments/bakong/...` via `CustomerPaymentModule`.
 */
@Controller("bakong")
export class CustomerBakongPaymentController {
  constructor(private readonly _bakong: BakongService) {}

  @Post("intent")
  async createIntent(
    @Body() body: CreateBakongIntentDto,
    @UserDecorator() user: User,
  ) {
    const data = await this._bakong.createIntentForCustomerOrder(user.id, body.order_id);
    return { data, message: "Scan the QR with any KHQR-enabled bank app to pay." };
  }

  /** Poll while the customer completes payment (same payload shape as cashier POS). */
  @Get("order/:id/payment-state")
  async paymentState(
    @Param("id", ParseIntPipe) id: number,
    @UserDecorator() user: User,
  ) {
    await this._bakong.assertCustomerOwnsOrder(user.id, id);
    return await this._bakong.getPaymentStateForPos(id);
  }

  /** Expire an unused pending KHQR so the customer can generate a new one or pay later. */
  @Post("order/:id/abandon")
  async abandon(
    @Param("id", ParseIntPipe) id: number,
    @UserDecorator() user: User,
  ) {
    const result = await this._bakong.abandonPendingBakongForOrder(user.id, id);
    return {
      ...result,
      message:
        result.data.abandoned_count > 0
          ? "Previous QR cancelled. You can generate a new one when ready."
          : "No active QR to cancel.",
    };
  }
}
