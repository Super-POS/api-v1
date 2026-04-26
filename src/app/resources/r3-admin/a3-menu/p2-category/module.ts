// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { TelegramService }                              from "@app/resources/r4-testing/third-party/telegram/service";
import { FileService } from '@app/services/file.service';
import { MenuTypeController } from './controller';
import { MenuTypeService } from './service';

@Module({
    controllers: [MenuTypeController],
    providers: [MenuTypeService, FileService, TelegramService]
})
export class MenuTypeModule { }
