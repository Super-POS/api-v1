import { BadRequestException, Injectable } from '@nestjs/common';

import PosExchangeSetting from '@app/models/setting/pos_exchange_setting.model';

export const FALLBACK_KHR_PER_USD = 4100;

/** Same rounding as web-v1 `ExchangeRateSettingService.khrToUsd` (KHR stored, USD display). */
export function khrToUsdDisplay(khr: number | null | undefined, khrPerUsd: number): number {
    const k = Number(khr ?? 0);
    const r = Number(khrPerUsd);
    if (!Number.isFinite(k) || !Number.isFinite(r) || r <= 0) {
        return 0;
    }
    return Math.round((k / r) * 10000) / 10000;
}

@Injectable()
export class ExchangeSettingService {
    async getKhrPerUsd(): Promise<number> {
        try {
            const row = await PosExchangeSetting.findByPk(1);
            const raw = row?.khr_per_usd;
            const v = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
            return Number.isFinite(v) && v > 0 ? v : FALLBACK_KHR_PER_USD;
        } catch {
            return FALLBACK_KHR_PER_USD;
        }
    }

    async setKhrPerUsd(raw: unknown): Promise<{ khr_per_usd: number }> {
        const v = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
        if (!Number.isFinite(v)) {
            throw new BadRequestException('Invalid exchange rate.');
        }
        if (v < 1000 || v > 100000) {
            throw new BadRequestException('Exchange rate must be between 1000 and 100000.');
        }
        await PosExchangeSetting.upsert({
            id: 1,
            khr_per_usd: v,
            updated_at: new Date(),
        });
        const next = await this.getKhrPerUsd();
        return { khr_per_usd: next };
    }
}
