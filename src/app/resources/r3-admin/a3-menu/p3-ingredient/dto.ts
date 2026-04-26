// ===========================================================================>> Custom Library
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

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
}
