import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';

import { RolesDecorator } from '@app/core/decorators/roles.decorator';
import { RoleGuard } from '@app/core/guards/role.guard';
import { RoleEnum } from '@app/enums/role.enum';
import { ExchangeSettingService } from '@app/services/exchange-setting.service';

import { PatchExchangeRateDto } from './dto';

@Controller()
@UseGuards(RoleGuard)
@RolesDecorator(RoleEnum.ADMIN)
export class AdminExchangeSettingController {
    constructor(private readonly _service: ExchangeSettingService) {}

    @Get()
    async get() {
        const khr_per_usd = await this._service.getKhrPerUsd();
        return { data: { khr_per_usd }, message: 'OK' };
    }

    @Patch()
    async patch(@Body() body: PatchExchangeRateDto) {
        const data = await this._service.setKhrPerUsd(body.khr_per_usd);
        return { data, message: 'Exchange rate updated.' };
    }
}
