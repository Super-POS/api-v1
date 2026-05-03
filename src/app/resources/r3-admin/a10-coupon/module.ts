import { Module } from '@nestjs/common';
import { AdminCouponController } from './controller';
import { AdminCouponService } from './service';

@Module({
    controllers: [AdminCouponController],
    providers: [AdminCouponService],
})
export class AdminCouponModule {}
