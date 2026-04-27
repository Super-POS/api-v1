// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';
// ===========================================================================>> Custom Library
import { ModifierAdminController } from './modifier.controller';
import { ModifierAdminService } from './modifier.service';

@Module({
    controllers: [ModifierAdminController],
    providers: [ModifierAdminService],
})
export class ModifierAdminModule {}
