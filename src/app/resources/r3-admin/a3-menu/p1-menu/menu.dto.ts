// ===========================================================================>> Custom Library
import { IsBase64Image } from '@app/core/decorators/base64-image.decorator';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';

export class MenuRecipeLineDto {
  @IsNumber()
  @IsPositive()
  ingredient_id: number;

  @IsNumber()
  @IsPositive()
  quantity: number;
}

export class CreateMenuDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsNumber()
  @IsPositive()
  type_id: number;

  @IsNumber()
  @IsPositive()
  unit_price: number;

  @IsString()
  @IsNotEmpty()
  @IsBase64Image({ message: 'Invalid image format. Image must be base64 encoded JPEG or PNG.' })
  image: string;

  /**
   * Ingredient lines for one serving. Use an empty array for items with no depletion
   * (e.g. pre-made pastries) — the field is still required on create.
   */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuRecipeLineDto)
  recipes: MenuRecipeLineDto[];
}

export class UpdateMenuDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsNumber()
  @IsPositive()
  type_id: number;

  @IsNumber()
  @IsPositive()
  unit_price: number;

  @IsOptional()
  @IsString()
  @IsBase64Image({ message: 'Invalid image format. Image must be base64 encoded JPEG or PNG.' })
  image: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuRecipeLineDto)
  recipes: MenuRecipeLineDto[];
}
