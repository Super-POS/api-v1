// =========================================================================>> Core Library
import { Module }      from '@nestjs/common';
import { HttpModule }  from '@nestjs/axios';

// =========================================================================>> Custom Library
import { CustomerOrderController } from './controller';
import { CustomerOrderService }    from './service';
import { TelegramService }         from '@app/services/telegram.service';
import { RewardEngineService }     from '@app/services/reward-engine.service';
import { BadgeAiService }          from '@app/services/badge-ai.service';

@Module({
    imports     : [HttpModule],
    controllers : [CustomerOrderController],
    providers   : [CustomerOrderService, TelegramService, RewardEngineService, BadgeAiService],
    exports     : [CustomerOrderService],
})
export class CustomerOrderModule {}
