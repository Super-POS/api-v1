// ===========================================================================>> Core Library
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

// ===========================================================================>> Custom Library
import { MissionRequirementType, MissionStatus } from '@app/models/loyalty/mission.model';
import { StampCategory }                          from '@app/models/loyalty/stamp.model';

// ─── Stamp DTOs ──────────────────────────────────────────────────────────────

export class CreateStampDto {
    @IsString()
    @MaxLength(200)
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsEnum(StampCategory)
    category: StampCategory;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    trigger_condition?: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    points_bonus?: number;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    icon?: string;
}

export class UpdateStampDto {
    @IsOptional()
    @IsString()
    @MaxLength(200)
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsEnum(StampCategory)
    category?: StampCategory;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    trigger_condition?: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    points_bonus?: number;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    icon?: string;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}

// ─── Mission DTOs ─────────────────────────────────────────────────────────────

export class CreateMissionDto {
    @IsString()
    @MaxLength(200)
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsEnum(MissionRequirementType)
    requirement_type: MissionRequirementType;

    @IsInt()
    @Min(1)
    target_value: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    reward_points?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    reward_stamp_id?: number;

    @IsOptional()
    @IsEnum(MissionStatus)
    status?: MissionStatus;

    @IsOptional()
    @IsString()
    start_date?: string;

    @IsOptional()
    @IsString()
    end_date?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    max_completions_per_user?: number;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    icon?: string;
}

export class UpdateMissionDto {
    @IsOptional()
    @IsString()
    @MaxLength(200)
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsEnum(MissionRequirementType)
    requirement_type?: MissionRequirementType;

    @IsOptional()
    @IsInt()
    @Min(1)
    target_value?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    reward_points?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    reward_stamp_id?: number;

    @IsOptional()
    @IsEnum(MissionStatus)
    status?: MissionStatus;

    @IsOptional()
    @IsString()
    start_date?: string;

    @IsOptional()
    @IsString()
    end_date?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    max_completions_per_user?: number;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    icon?: string;
}
