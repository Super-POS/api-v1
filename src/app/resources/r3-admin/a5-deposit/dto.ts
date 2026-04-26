// ===========================================================================>> Custom Library
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateDepositDto {
    @IsInt()
    @IsPositive()
    customer_id: number;

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

export class ReviewDepositDto {
    @IsString()
    @IsOptional()
    note?: string;
}

export class DepositQueryDto {
    @IsOptional()
    page?: number;

    @IsOptional()
    limit?: number;

    @IsInt()
    @IsOptional()
    customer_id?: number;

    @IsString()
    @IsOptional()
    status?: string;
}
