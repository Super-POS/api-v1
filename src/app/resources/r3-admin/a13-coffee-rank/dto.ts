import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateCoffeeRankTierDto {
    @IsOptional()
    @IsString()
    @MaxLength(200)
    label?: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    min_points?: number;
}
