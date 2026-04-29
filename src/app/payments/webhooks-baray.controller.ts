// ===========================================================================>> Core Library
import { Body, Controller, HttpCode, HttpStatus, Logger, Post } from "@nestjs/common";

// ===========================================================================>> Custom Library
import { BarayService } from "src/app/services/baray.service";

/**
 * Mounted under `api/webhooks` via RouterModule. Full path: `POST /api/webhooks/baray`.
 * Excludes JWT in AppModule. Register this URL in the Baray dashboard.
 */
@Controller()
export class BarayWebhookController {
  private readonly logger = new Logger(BarayWebhookController.name);

  constructor(private readonly _baray: BarayService) {}

  @Post("baray")
  @HttpCode(HttpStatus.OK)
  async baray(@Body() body: Record<string, unknown>): Promise<{ ok: boolean }> {
    try {
      await this._baray.handleWebhook(body);
    } catch (e) {
      this.logger.error(`Baray webhook failed: ${(e as Error).message}`, (e as Error).stack);
      throw e;
    }
    return { ok: true };
  }
}
