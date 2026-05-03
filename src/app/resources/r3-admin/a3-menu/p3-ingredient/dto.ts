// ===========================================================================>> Custom Library
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class CreateMenuIngredientDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsOptional()
    unit?: string;

    @IsNumber()
    @IsPositive()
    quantity: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    low_stock_threshold?: number;
}

export class UpdateMenuIngredientDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsOptional()
    unit?: string;

    @IsNumber()
    @IsPositive()
    quantity: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    low_stock_threshold?: number;
}

/** Add this amount to the ingredient's current `quantity` (server-side increment). */
export class RestockMenuIngredientDto {
    @Type(() => Number)
    @IsNumber()
    @IsPositive()
    add: number;
}
