// ===========================================================================>> Core Library
import { forwardRef, Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";

// ===========================================================================>> Custom Library
import { OrderModule } from "src/app/resources/r2-cashier/c1-order/module";
import { NotificationGetwayModule } from "src/app/utils/notification-getway/notifications.gateway.module";
import { BakongService } from "src/app/services/bakong.service";

@Module({
  imports: [HttpModule, NotificationGetwayModule, forwardRef(() => OrderModule)],
  providers: [BakongService],
  exports: [BakongService, HttpModule],
})
export class BakongModule {}
