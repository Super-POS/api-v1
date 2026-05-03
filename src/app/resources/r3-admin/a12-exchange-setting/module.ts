import { Module } from '@nestjs/common';

import { AdminExchangeSettingController } from './controller';

@Module({
    controllers: [AdminExchangeSettingController],
})
export class AdminExchangeSettingModule {}
