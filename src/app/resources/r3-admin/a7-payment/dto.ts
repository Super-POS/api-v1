// ===========================================================================>> Custom Library
import { IsEnum, IsInt, IsOptional, IsPositive, IsString } from 'class-validator';
import { PaymentStatus } from '@app/models/payment/payment_transaction.model';

export class UpdatePaymentStatusDto {
    @IsEnum(PaymentStatus)
    status: PaymentStatus;

    @IsString()
    @IsOptional()
    note?: string;
}

export class PaymentQueryDto {
    @IsOptional()
    page?: number;

    @IsOptional()
    limit?: number;

    @IsString()
    @IsOptional()
    status?: string;

    @IsInt()
    @IsPositive()
    @IsOptional()
    order_id?: number;

    @IsInt()
    @IsPositive()
    @IsOptional()
    customer_id?: number;
}
