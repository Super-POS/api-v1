import { Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsDateString,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
    MinLength,
    ValidateIf,
} from 'class-validator';

export class CreateCouponDto {
    @ValidateIf((o: CreateCouponDto) => !o.auto_generate_code)
    @IsNotEmpty()
    @IsString()
    @MinLength(2)
    @MaxLength(64)
    code?: string;

    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    /** When true, the API assigns a unique random code and ignores `code`. */
    auto_generate_code?: boolean;

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

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    usage_limit?: number | null;

    @IsOptional()
    @IsDateString()
    expires_at?: string | null;

    /** User IDs that may redeem this coupon. Empty array or omitted = any user. */
    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    @Min(1, { each: true })
    assigned_user_ids?: number[];
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

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    usage_limit?: number | null;

    @IsOptional()
    @IsDateString()
    expires_at?: string | null;

    /** Replaces the full assignment list. Empty array = remove all assignments (open to everyone). */
    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    @Min(1, { each: true })
    assigned_user_ids?: number[];
}
