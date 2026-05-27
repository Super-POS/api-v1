import { Module } from '@nestjs/common';
import { PLController } from './controller';
import { PLService } from './service';
import { ProfitService } from '@app/services/profit.service';

@Module({
    controllers: [PLController],
    providers  : [PLService, ProfitService],
})
export class PLModule {}
