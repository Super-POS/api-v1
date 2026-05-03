import { Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateCouponDto {
    @IsNotEmpty()
    @IsString()
    @MinLength(2)
    @MaxLength(64)
    code: string;

    @IsNotEmpty()
    @Type(() => Number)
    @IsNumber()
    @Min(0.01)
    @Max(100)
    discount_percent: number;

    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    is_active?: boolean;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    note?: string | null;
}

export class UpdateCouponDto {
    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(64)
    code?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0.01)
    @Max(100)
    discount_percent?: number;

    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    is_active?: boolean;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    note?: string | null;
}
