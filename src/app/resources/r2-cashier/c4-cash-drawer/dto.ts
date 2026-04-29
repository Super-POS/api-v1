// ===========================================================================>> Custom Library
import { Type } from 'class-transformer';
import {
    IsInt,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    Min,
    ValidateNested,
} from 'class-validator';

export class ReceivedDenominationsDto {

    // USD received from customer
    @IsInt() @Min(0) @IsOptional() usd_1?:   number;
    @IsInt() @Min(0) @IsOptional() usd_5?:   number;
    @IsInt() @Min(0) @IsOptional() usd_20?:  number;
    @IsInt() @Min(0) @IsOptional() usd_50?:  number;
    @IsInt() @Min(0) @IsOptional() usd_100?: number;

    // KHR received from customer
    @IsInt() @Min(0) @IsOptional() khr_100?:    number;
    @IsInt() @Min(0) @IsOptional() khr_200?:    number;
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
    @IsInt() @Min(0) @IsOptional() khr_200000?: number;
}

export class MakeChangeDto {

    @IsInt()
    @IsPositive()
    order_id: number;

    @ValidateNested()
    @Type(() => ReceivedDenominationsDto)
    received: ReceivedDenominationsDto;

    /**
     * Exchange rate: how many KHR equals 1 USD.
     * Defaults to 4100 if not provided.
     */
    @IsNumber()
    @IsPositive()
    @IsOptional()
    exchange_rate?: number;

    @IsString()
    @IsOptional()
    note?: string;
}
