// =========================================================================>> Custom Library
import { OrderChannelEnum } from '@app/enums/order-channel.enum';
import { IsIn, IsJSON, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class PlaceOrderDto {
    @IsNotEmpty()
    @IsJSON()
    cart: string;

    @IsNotEmpty()
    @IsIn([OrderChannelEnum.TELEGRAM, OrderChannelEnum.WEBSITE], {
        message: `channel must be one of: ${OrderChannelEnum.TELEGRAM}, ${OrderChannelEnum.WEBSITE}`,
    })
    channel: OrderChannelEnum.TELEGRAM | OrderChannelEnum.WEBSITE;

    @IsOptional()
    @IsString()
    @MaxLength(64)
    coupon_code?: string | null;
}
