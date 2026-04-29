// ===========================================================================>> Custom Library
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class RequestDepositDto {
    @IsNumber()
    @IsPositive()
    amount: number;

    @IsString()
    @IsOptional()
    reference?: string;

    @IsString()
    @IsOptional()
    note?: string;
}

export class CreateBarayWalletDepositIntentDto {
    @Type(() => Number)
    @IsNumber()
    @IsPositive()
    amount: number;

    @IsString()
    @IsOptional()
    note?: string;
}
