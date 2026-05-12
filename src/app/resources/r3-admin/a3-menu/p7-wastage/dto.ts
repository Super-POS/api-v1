// ===========================================================================>> Custom Library
import { IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { WastageReason } from '@app/models/menu/wastage.model';

export class CreateIngredientWastageDto {
    @IsInt()
    @IsPositive()
    ingredient_id: number;

    @IsEnum(WastageReason)
    reason: WastageReason;

    @IsNumber()
    @IsPositive()
    quantity: number;

    @IsString()
    @IsOptional()
    note?: string;
}

export class CreateRecipeWastageDto {
    @IsInt()
    @IsPositive()
    menu_id: number;

    @IsEnum(WastageReason)
    reason: WastageReason;

    @IsNumber()
    @IsPositive()
    quantity: number;

    @IsString()
    @IsOptional()
    note?: string;
}
