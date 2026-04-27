import { Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Min,
    ValidateNested,
} from 'class-validator';

export class CreateModifierGroupDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsOptional()
    code?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    sort_order?: number;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}

export class UpdateModifierGroupDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    name?: string;

    @IsOptional()
    @IsString()
    code?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    sort_order?: number;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}

export class IngredientRecipeLineDto {
    @IsNumber()
    ingredient_id: number;

    @IsNumber()
    @Min(0)
    quantity: number;
}

export class CreateModifierOptionDto {
    @IsString()
    @IsNotEmpty()
    label: string;

    @IsOptional()
    @IsString()
    code?: string;

    @IsOptional()
    @IsNumber()
    price_delta?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    sort_order?: number;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @IsOptional()
    @IsBoolean()
    is_default?: boolean;

    /** Extra stock lines per 1 line unit, same as menu `recipes` */
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => IngredientRecipeLineDto)
    ingredient_recipe?: IngredientRecipeLineDto[];
}

export class UpdateModifierOptionDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    label?: string;

    @IsOptional()
    @IsString()
    code?: string;

    @IsOptional()
    @IsNumber()
    price_delta?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    sort_order?: number;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @IsOptional()
    @IsBoolean()
    is_default?: boolean;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => IngredientRecipeLineDto)
    ingredient_recipe?: IngredientRecipeLineDto[];
}

export class MenuModifierAssignmentItemDto {
    @IsNumber()
    modifier_group_id: number;

    @IsNumber()
    @Min(0)
    sort_order: number;

    @IsOptional()
    @IsBoolean()
    is_required?: boolean;
}

export class SetMenuModifiersDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MenuModifierAssignmentItemDto)
    items: MenuModifierAssignmentItemDto[];
}
