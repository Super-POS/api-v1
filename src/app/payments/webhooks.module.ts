// ===========================================================================>> Core Library
import { Module } from "@nestjs/common";

// ===========================================================================>> Custom Library
import { PaywayModule } from "src/app/payments/payway.module";
import { PaywayWebhookController } from "src/app/payments/webhooks-payway.controller";

@Module({
  imports: [PaywayModule],
  controllers: [PaywayWebhookController],
})
export class WebhooksModule {}
