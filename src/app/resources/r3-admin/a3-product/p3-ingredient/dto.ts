import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateIngredientDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stock: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  low_stock_threshold?: number;
}

export class CreateIngredientDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  unit: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stock: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  low_stock_threshold?: number;
}
