import { Module } from '@nestjs/common';

import { CashierExchangeSettingController } from './controller';

@Module({
    controllers: [CashierExchangeSettingController],
})
export class CashierExchangeSettingModule {}
