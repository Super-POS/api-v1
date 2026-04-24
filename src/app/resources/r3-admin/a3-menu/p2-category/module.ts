// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { TelegramService }                              from "@app/resources/r4-testing/third-party/telegram/service";
import { FileService } from '@app/services/file.service';
import { ProductTypeController } from './controller';
import { ProductTypeService } from './service';

@Module({
    controllers: [ProductTypeController],
    providers: [ProductTypeService, FileService, TelegramService]
})
export class ProductTypeModule { }
