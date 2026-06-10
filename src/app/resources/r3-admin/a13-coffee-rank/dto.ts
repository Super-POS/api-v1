import {
    IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min,
} from 'class-validator';
import { RankRewardType } from '@app/models/setting/coffee_rank_tier_reward.model';

export class UpdateCoffeeRankTierDto {
    @IsOptional()
    @IsString()
    @MaxLength(200)
    label?: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    min_points?: number;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    icon?: string;
}

export class CreateRankRewardDto {
    @IsEnum(RankRewardType)
    type: RankRewardType;

    @IsString()
    @MaxLength(200)
    label: string;

    @IsOptional()
    @IsString()
    description?: string;

    /** Required when type = coupon */
    @IsOptional()
    @IsNumber()
    @Min(0.01)
    @Max(100)
    coupon_discount_percent?: number;

    /** Days until the coupon expires; null = no expiry */
    @IsOptional()
    @IsInt()
    @Min(1)
    coupon_expires_days?: number;

    /** Required when type = item */
    @IsOptional()
    @IsInt()
    @Min(1)
    menu_id?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    quantity?: number;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}

export class UpdateRankRewardDto {
    @IsOptional()
    @IsString()
    @MaxLength(200)
    label?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsNumber()
    @Min(0.01)
    @Max(100)
    coupon_discount_percent?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    coupon_expires_days?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    menu_id?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    quantity?: number;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}
