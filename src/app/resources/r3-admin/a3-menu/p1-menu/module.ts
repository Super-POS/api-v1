// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';

// ===========================================================================>> Third Party Library

// ===========================================================================>> Costom Library
// Custom Components:
import { FileService } from 'src/app/services/file.service';// for uploading file

import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

@Module({
    controllers: [
        MenuController
    ],
    providers: [
        FileService,
        MenuService
    ]
})
export class MenuModule {}
