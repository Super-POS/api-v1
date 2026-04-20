// ===========================================================================>> Core Library
import { Routes } from '@nestjs/core';

// ===========================================================================>> Custom Library
import { FileModule } from './file-service/module';

import { BasicModule } from './basic/module';
import { MyProfileModule } from './my-profile/my_profile.module';
import { TelegramModule } from './third-party/telegram/module';

export const testingRoutes: Routes = [
    {
        path: 'basic',
        module: BasicModule
    }, 

    {
        path: 'upload',
        module: FileModule
    }, 

    {
        path: 'telegram',
        module: TelegramModule
    }, 
    {
        path: 'my-profile',
        module: MyProfileModule
    }, 
    // {
    //     path: 'sms',
    //     module: SMSModule
    // },
    // {
    //     path: 'report',
    //     module: ReportJSModule
    // }
];