// ===========================================================================>> Custom Library
import { IsInt, IsNotEmpty, IsNumber, IsPositive } from 'class-validator';

export class CreateProductRecipeDto {
    @IsInt()
    @IsPositive()
    product_id: number;

    @IsInt()
    @IsPositive()
    ingredient_id: number;

    @IsNumber()
    @IsPositive()
    quantity: number;
}

export class UpdateProductRecipeDto {
    @IsNumber()
    @IsPositive()
    @IsNotEmpty()
    quantity: number;
}
