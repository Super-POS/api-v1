// =========================================================================>> Custom Library
import { OrderChannelEnum } from '@app/enums/order-channel.enum';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsJSON, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateOrderDto {
    @IsNotEmpty()
    @IsJSON()
    cart: string;

    @IsNotEmpty()
    @IsEnum(OrderChannelEnum)
    channel: OrderChannelEnum;

    /**
     * When true (e.g. POS will pay with Baray): skip Telegram + in-app “new order” push until
     * Baray webhook runs — same moment we open receipt in the app.
     */
    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    deferred_telegram?: boolean;
}
