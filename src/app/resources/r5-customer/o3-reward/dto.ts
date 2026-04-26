// ===========================================================================>> Custom Library
import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class RedeemRewardDto {
    @IsInt()
    @IsPositive()
    points: number;

    @IsString()
    @IsOptional()
    reference?: string;
}
