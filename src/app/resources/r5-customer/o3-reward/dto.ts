// ===========================================================================>> Custom Library
import { IsArray, IsInt, IsOptional, IsPositive, IsString, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class RedeemRewardDto {
    @IsInt()
    @IsPositive()
    points: number;

    @IsString()
    @IsOptional()
    reference?: string;
}

export class AssignBadgeDto {
    /** Exactly 5 answers — one per BADGE_QUESTIONS entry */
    @IsArray()
    @ArrayMinSize(5)
    @ArrayMaxSize(5)
    @IsString({ each: true })
    answers: string[];
}
