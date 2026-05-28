// ===========================================================================>> Custom Library
import { MenuSizeEnum } from '@app/enums/menu-size.enum';
import { IsBase64Image } from '@app/core/decorators/base64-image.decorator';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateIf,
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

export class MenuSizeDto {
  @IsEnum(MenuSizeEnum)
  size: MenuSizeEnum;

  @IsNumber()
  @IsPositive()
  price: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuRecipeLineDto)
  recipes: MenuRecipeLineDto[];
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

  @IsOptional()
  @IsBoolean()
  has_sizes?: boolean;

  /** Required when has_sizes is false or omitted. */
  @ValidateIf((o) => !o.has_sizes)
  @IsNumber()
  @IsPositive()
  unit_price?: number;

  @IsString()
  @IsNotEmpty()
  @IsBase64Image({ message: 'Invalid image format. Image must be base64 encoded JPEG or PNG.' })
  image: string;

  /**
   * Required when has_sizes is false. Use an empty array for items with no stock depletion.
   * Ignored when has_sizes is true (each size carries its own recipes).
   */
  @ValidateIf((o) => !o.has_sizes)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuRecipeLineDto)
  recipes?: MenuRecipeLineDto[];

  /** Required when has_sizes is true. Must have 1–3 entries, one per size (S, M, or L). */
  @ValidateIf((o) => !!o.has_sizes)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => MenuSizeDto)
  sizes?: MenuSizeDto[];
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

  @IsOptional()
  @IsBoolean()
  has_sizes?: boolean;

  @ValidateIf((o) => !o.has_sizes)
  @IsNumber()
  @IsPositive()
  unit_price?: number;

  @IsOptional()
  @IsString()
  @IsBase64Image({ message: 'Invalid image format. Image must be base64 encoded JPEG or PNG.' })
  image?: string;

  @ValidateIf((o) => !o.has_sizes)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuRecipeLineDto)
  recipes?: MenuRecipeLineDto[];

  @ValidateIf((o) => !!o.has_sizes)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => MenuSizeDto)
  sizes?: MenuSizeDto[];
}
