// ===========================================================================>> Custom Library
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateProductIngredientDto {
    @IsNumber()
    @IsPositive()
    product_id: number;

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
