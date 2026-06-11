// ===========================================================================>> Core Library
import { IsInt, IsOptional, Min } from 'class-validator';

export class AcceptMissionDto {
    @IsInt()
    @Min(1)
    mission_id: number;
}

export class MissionProgressQueryDto {
    @IsOptional()
    @IsInt()
    @Min(1)
    page?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    limit?: number;
}
