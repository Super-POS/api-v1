// ===========================================================================>> Core Library
import { Body, Controller, Logger, Post } from "@nestjs/common";

// ===========================================================================>> Custom Library
import { PaywayService } from "src/app/services/payway.service";

/** PayWay pushback — POST /api/webhooks/payway (no JWT). */
@Controller("payway")
export class PaywayWebhookController {
  private readonly logger = new Logger(PaywayWebhookController.name);

  constructor(private readonly _payway: PaywayService) {}

  @Post()
  async handle(@Body() body: Record<string, unknown>) {
    try {
      await this._payway.handleWebhookPayload(body ?? {});
      return { status: "ok" };
    } catch (e) {
      this.logger.error(`PayWay webhook failed: ${(e as Error).message}`, (e as Error).stack);
      return { status: "error" };
    }
  }
}
