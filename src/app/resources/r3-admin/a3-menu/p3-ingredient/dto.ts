// ===========================================================================>> Custom Library
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateProductIngredientDto {
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

export class UpdateProductIngredientDto {
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
