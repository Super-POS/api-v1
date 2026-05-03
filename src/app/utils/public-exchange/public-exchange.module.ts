// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { PublicExchangeController } from './public-exchange.controller';

@Module({
    controllers: [PublicExchangeController],
})
export class PublicExchangeModule {}
