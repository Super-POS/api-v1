import { Controller, Get, UseGuards } from '@nestjs/common';

import { RolesDecorator } from '@app/core/decorators/roles.decorator';
import { RoleGuard } from '@app/core/guards/role.guard';
import { RoleEnum } from '@app/enums/role.enum';
import { ExchangeSettingService } from '@app/services/exchange-setting.service';

@Controller()
@UseGuards(RoleGuard)
@RolesDecorator(RoleEnum.CASHIER)
export class CashierExchangeSettingController {
    constructor(private readonly _service: ExchangeSettingService) {}

    @Get()
    async get() {
        const khr_per_usd = await this._service.getKhrPerUsd();
        return { data: { khr_per_usd }, message: 'OK' };
    }
}
