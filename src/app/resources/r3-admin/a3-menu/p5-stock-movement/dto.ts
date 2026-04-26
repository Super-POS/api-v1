// ===========================================================================>> Custom Library
import { IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { StockMovementType } from '@app/models/product/stock_movement.model';

export class CreateStockMovementDto {
    @IsInt()
    @IsPositive()
    ingredient_id: number;

    @IsEnum(StockMovementType)
    type: StockMovementType;

    @IsNumber()
    @IsPositive()
    quantity: number;

    @IsString()
    @IsOptional()
    note?: string;
}
