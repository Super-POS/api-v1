// =========================================================================>> Core Library
import { Module } from '@nestjs/common';

// =========================================================================>> Custom Library
import { OrderModule }      from '../c1-order/module';
import { ManageController } from './controller';
import { ManageService }    from './service';

@Module({
    imports     : [OrderModule],
    controllers : [ManageController],
    providers   : [ManageService],
})
export class ManageModule {}
