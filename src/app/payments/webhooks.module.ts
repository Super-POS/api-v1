// ===========================================================================>> Core Library
import { Module } from "@nestjs/common";

// ===========================================================================>> Custom Library
import { BarayModule } from "src/app/payments/baray.module";
import { BarayWebhookController } from "src/app/payments/webhooks-baray.controller";

@Module({
  imports: [BarayModule],
  controllers: [BarayWebhookController],
})
export class WebhooksModule {}
