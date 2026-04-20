// =========================================================================>> Core Library
import { Module } from '@nestjs/common';

// =========================================================================>> Custom Library
import { BasicController } from './controller';

// ======================================= >> Code Starts Here << ========================== //
@Module({
    controllers: [BasicController]
})
export class BasicModule { }
