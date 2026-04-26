// =========================================================================>> Core Library
import { Module } from '@nestjs/common';

// =========================================================================>> Custom Library
import { CustomerOrderModule } from '@app/resources/r5-customer/o1-order/module';
import { PublicMenuController } from './public-menu.controller';

@Module({
    imports    : [CustomerOrderModule],
    controllers: [PublicMenuController],
})
export class PublicMenuModule {}
