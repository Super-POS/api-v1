// =========================================================================>> Custom Library
import { OrderChannelEnum } from '@app/enums/order-channel.enum';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsJSON, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

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

    @IsOptional()
    @IsString()
    @MaxLength(64)
    coupon_code?: string;

    /** Required when applying a coupon that is restricted to a specific user. */
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    customer_id?: number;
}
