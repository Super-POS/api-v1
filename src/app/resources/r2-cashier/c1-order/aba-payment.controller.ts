// ===========================================================================>> Core Library
import { Body, Controller, Get, Param, ParseIntPipe, Post } from "@nestjs/common";

// ===========================================================================>> Custom Library
import UserDecorator from "@app/core/decorators/user.decorator";
import User from "@app/models/user/user.model";
import { PaywayService } from "src/app/services/payway.service";
import { CreatePaywayIntentDto } from "src/app/payments/dto/create-payway-intent.dto";

/** ABA PayWay QR payment for cashier orders — api/cashier/ordering/aba/... */
@Controller("aba")
export class AbaPaymentController {
  constructor(private readonly _payway: PaywayService) {}

  @Post("payment-intent")
  async createIntent(
    @Body() body: CreatePaywayIntentDto,
    @UserDecorator() user: User,
  ) {
    const data = await this._payway.createIntentForCashierOrder(
      user.id,
      body.order_id,
      body.payment_option,
    );
    return { data, message: "Display the QR code for the customer to scan." };
  }

  @Get("order/:id/payment-state")
  async paymentState(@Param("id", ParseIntPipe) id: number) {
    return await this._payway.getPaymentStateForPos(id);
  }
}
