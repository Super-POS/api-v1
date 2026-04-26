// ===========================================================================>> Custom Library
import { IsEnum, IsInt, IsOptional, IsPositive, IsString } from 'class-validator';
import { PaymentMethod } from '@app/models/payment/payment_transaction.model';

export class InitiatePaymentDto {
    @IsInt()
    @IsPositive()
    order_id: number;

    @IsEnum(PaymentMethod)
    method: PaymentMethod;

    @IsString()
    @IsOptional()
    reference?: string;

    @IsString()
    @IsOptional()
    note?: string;
}
