// =========================================================================>> Core Library
import { Module } from '@nestjs/common';

// =========================================================================>> Custom Library
import { ManageController } from './controller';
import { ManageService }    from './service';

@Module({
    controllers : [ManageController],
    providers   : [ManageService],
})
export class ManageModule {}
