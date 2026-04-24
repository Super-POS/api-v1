// =========================================================================>> Custom Library
import { OrderChannelEnum } from '@app/enums/order-channel.enum';
import { IsEnum, IsJSON, IsNotEmpty } from 'class-validator';

export class PlaceOrderDto {
    @IsNotEmpty()
    @IsJSON()
    cart: string;

    @IsNotEmpty()
    @IsEnum([OrderChannelEnum.TELEGRAM, OrderChannelEnum.WEBSITE], {
        message: `channel must be one of: ${OrderChannelEnum.TELEGRAM}, ${OrderChannelEnum.WEBSITE}`,
    })
    channel: OrderChannelEnum.TELEGRAM | OrderChannelEnum.WEBSITE;
}
