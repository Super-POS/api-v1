// =========================================================================>> Core Library
import { Module } from '@nestjs/common';

// =========================================================================>> Custom Library
import { FileController } from './controller';

// ======================================= >> Code Starts Here << ========================== //
@Module({
    controllers: [FileController]
})
export class FileModule { }
