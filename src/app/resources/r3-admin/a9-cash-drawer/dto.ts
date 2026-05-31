// ===========================================================================>> Custom Library
import { Type } from 'class-transformer';
import {
    IsInt,
    IsOptional,
    IsString,
    Min,
    ValidateNested,
} from 'class-validator';

export class DenominationInputDto {

    // USD
    @IsInt() @Min(0) @IsOptional() usd_1?:   number;
    @IsInt() @Min(0) @IsOptional() usd_5?:   number;
    @IsInt() @Min(0) @IsOptional() usd_20?:  number;
    @IsInt() @Min(0) @IsOptional() usd_50?:  number;
    @IsInt() @Min(0) @IsOptional() usd_100?: number;

    // KHR
    @IsInt() @Min(0) @IsOptional() khr_100?:    number;
    @IsInt() @Min(0) @IsOptional() khr_500?:    number;
    @IsInt() @Min(0) @IsOptional() khr_1000?:   number;
    @IsInt() @Min(0) @IsOptional() khr_2000?:   number;
    @IsInt() @Min(0) @IsOptional() khr_5000?:   number;
    @IsInt() @Min(0) @IsOptional() khr_10000?:  number;
    @IsInt() @Min(0) @IsOptional() khr_15000?:  number;
    @IsInt() @Min(0) @IsOptional() khr_20000?:  number;
    @IsInt() @Min(0) @IsOptional() khr_30000?:  number;
    @IsInt() @Min(0) @IsOptional() khr_50000?:  number;
    @IsInt() @Min(0) @IsOptional() khr_100000?: number;
}

export class DepositCashDto {

    @ValidateNested()
    @Type(() => DenominationInputDto)
    denominations: DenominationInputDto;

    @IsString()
    @IsOptional()
    note?: string;
}

/** Same shape as deposit: counts per denomination to remove from the drawer. */
export class WithdrawCashDto extends DepositCashDto {}

export class ResetBalanceDto {

    @IsString()
    @IsOptional()
    note?: string;
}

export class CashDrawerLogQueryDto {

    @IsOptional()
    page?: number;

    @IsOptional()
    limit?: number;
}
