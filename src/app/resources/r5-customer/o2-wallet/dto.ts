// ===========================================================================>> Custom Library
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
