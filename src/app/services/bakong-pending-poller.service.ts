import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { BakongService } from "./bakong.service";

const DEFAULT_POLL_MS = 45_000;
const MIN_POLL_MS = 15_000;

/**
 * Periodically polls NBC for pending Bakong KHQR payments and wallet deposits
 * so funds settle even when no browser / Telegram client is polling.
 */
@Injectable()
export class BakongPendingPollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BakongPendingPollerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly _bakong: BakongService) {}

  onModuleInit(): void {
    const disabled = String(process.env.BAKONG_BACKGROUND_POLL ?? "true").toLowerCase() === "false";
    if (disabled) {
      this.logger.log("Bakong background polling is disabled (BAKONG_BACKGROUND_POLL=false).");
      return;
    }

    const rawMs = Number(process.env.BAKONG_BACKGROUND_POLL_MS || DEFAULT_POLL_MS);
    const intervalMs = Number.isFinite(rawMs)
      ? Math.max(MIN_POLL_MS, Math.floor(rawMs))
      : DEFAULT_POLL_MS;

    this.logger.log(`Bakong background polling every ${intervalMs}ms.`);
    this.timer = setInterval(() => void this.tick(), intervalMs);
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer != null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this._bakong.pollAllPendingBakongSettlements();
    } catch (e) {
      this.logger.warn(`Bakong background poll failed: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
