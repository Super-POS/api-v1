// ===========================================================================>> Custom Library
import { IsBase64Image } from '@app/core/decorators/base64-image.decorator'
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Min, ValidateNested } from 'class-validator'

export class RecipeIngredientDto {
    @Type(() => Number)
    @IsNumber()
    @IsPositive()
    ingredient_id: number

    @Type(() => Number)
    @IsNumber()
    @IsPositive()
    qty_required: number
}

export class CreateProductDto {
    @IsString()
    @IsNotEmpty()
    name: string

    @IsString()
    @IsNotEmpty()
    code: string

    @IsNumber()
    @IsPositive()
    type_id: number

    @IsNumber()
    @IsPositive()
    unit_price: number

    @IsOptional()
    @IsInt()
    @Min(0)
    stock?: number

    @IsString()
    @IsNotEmpty()
    @IsBase64Image({ message: 'Invalid image format. Image must be base64 encoded JPEG or PNG.' })
    image: string

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => RecipeIngredientDto)
    recipe?: RecipeIngredientDto[]
}

export class UpdateProductDto {
    @IsString()
    @IsNotEmpty()
    name: string

    @IsString()
    @IsNotEmpty()
    code: string

    @IsNumber()
    @IsPositive()
    type_id: number

    @IsNumber()
    @IsPositive()
    unit_price: number

    @IsOptional()
    @IsInt()
    @Min(0)
    stock?: number

    @IsOptional()
    @IsString()
    @IsBase64Image({ message: 'Invalid image format. Image must be base64 encoded JPEG or PNG.' })
    image: string

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => RecipeIngredientDto)
    recipe?: RecipeIngredientDto[]
}