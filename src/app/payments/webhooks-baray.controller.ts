// ===========================================================================>> Core Library
import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";

// ===========================================================================>> Custom Library
import { BarayService } from "src/app/services/baray.service";

/**
 * Mounted under `api/webhooks` via RouterModule. Full path: `POST /api/webhooks/baray`.
 * Excludes JWT in AppModule. Register this URL in the Baray dashboard.
 */
@Controller()
export class BarayWebhookController {
  constructor(private readonly _baray: BarayService) {}

  @Post("baray")
  @HttpCode(HttpStatus.OK)
  async baray(@Body() body: Record<string, unknown>): Promise<{ ok: boolean }> {
    await this._baray.handleWebhook(body);
    return { ok: true };
  }
}
