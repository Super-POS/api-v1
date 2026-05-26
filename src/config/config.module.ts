// ===========================================================================>> Core Library
import { Global, Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { SequelizeModule } from '@nestjs/sequelize';
// ===========================================================================>> Third Party Library
import * as multer from 'multer';
// ===========================================================================>> Costom Library
import sequelizeConfig from './sequelize.config';
import { HttpModule } from '@nestjs/axios';
import { FileService } from '@app/services/file.service';
import { JsReportService } from '@app/services/js-report.service';
import { CashDrawerLogEnumPatchService } from './cash-drawer-log-enum.patch';
import { CouponOrderSchemaPatchService } from './coupon-order-schema.patch';
import { IngredientSchemaPatchService } from './ingredient-schema.patch';
import { OrderNumberSchemaPatchService } from './order-number-schema.patch';
import { ExchangeSettingSchemaPatchService } from './exchange-setting-schema.patch';
import { ExchangeSettingService } from '@app/services/exchange-setting.service';
import { WastageSchemaPatchService } from './wastage-schema.patch';
import { BadgeSchemaPatchService } from './badge-schema.patch';
import { MeetingRoomSchemaPatchService } from './meeting-room-schema.patch';
import { MeetingRoomBookingPaymentSchemaPatchService } from './meeting-room-booking-payment-schema.patch';

/** @noded We use Global that allow all module can access and use all models */
@Global()
@Module({
    imports: [
        MulterModule.register({
            storage: multer.memoryStorage(),
        }),
        SequelizeModule.forRoot({
            ...sequelizeConfig
        }),
        HttpModule.register({
            timeout: 5000,
            maxRedirects: 5,
        }),
    ],
    providers: [
        FileService,
        JsReportService,
        IngredientSchemaPatchService,
        CouponOrderSchemaPatchService,
        CashDrawerLogEnumPatchService,
        OrderNumberSchemaPatchService,
        ExchangeSettingSchemaPatchService,
        ExchangeSettingService,
        WastageSchemaPatchService,
        BadgeSchemaPatchService,
        MeetingRoomSchemaPatchService,
        MeetingRoomBookingPaymentSchemaPatchService,
    ],
    exports: [
        FileService,
        JsReportService,
        ExchangeSettingService,
        HttpModule.register({
            timeout: 5000,
            maxRedirects: 5,
        }),
    ]
})
export class ConfigModule { }
