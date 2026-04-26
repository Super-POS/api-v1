// ===========================================================================>> Core Library
import { forwardRef, Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";

// ===========================================================================>> Custom Library
import { OrderModule } from "src/app/resources/r2-cashier/c1-order/module";
import { NotificationGetwayModule } from "src/app/utils/notification-getway/notifications.gateway.module";
import { BarayService } from "src/app/services/baray.service";

@Module({
  imports: [HttpModule, NotificationGetwayModule, forwardRef(() => OrderModule)],
  providers: [BarayService],
  exports: [BarayService, HttpModule],
})
export class BarayModule {}
