// ===========================================================================>> Core Library
import { Controller, Get } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { ExchangeSettingService } from '@app/services/exchange-setting.service';

/** Public POS exchange hint (no auth) — KHR stored in DB per 1 USD. */
@Controller()
export class PublicExchangeController {
    constructor(private readonly _exchange: ExchangeSettingService) {}

    @Get()
    async getExchangeRate(): Promise<{ data: { khr_per_usd: number }; message: string }> {
        const khr_per_usd = await this._exchange.getKhrPerUsd();
        return { data: { khr_per_usd }, message: 'OK' };
    }
}
