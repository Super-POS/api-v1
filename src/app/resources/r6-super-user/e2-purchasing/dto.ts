import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { PurchaseOrderStatus } from '@app/models/erp/purchase-order.model';

export class CreateSupplierDto {
    @IsString() @IsNotEmpty() name: string;
    @IsString() @IsOptional() contact_person?: string;
    @IsString() @IsOptional() phone?: string;
    @IsString() @IsOptional() email?: string;
    @IsString() @IsOptional() address?: string;
    @IsString() @IsOptional() payment_terms?: string;
    @IsString() @IsOptional() notes?: string;
}

export class UpdateSupplierDto {
    @IsString() @IsOptional() name?: string;
    @IsString() @IsOptional() contact_person?: string;
    @IsString() @IsOptional() phone?: string;
    @IsString() @IsOptional() email?: string;
    @IsString() @IsOptional() address?: string;
    @IsString() @IsOptional() payment_terms?: string;
    @IsBoolean() @IsOptional() is_active?: boolean;
    @IsString() @IsOptional() notes?: string;
}

export class PurchaseOrderItemDto {
    @IsNumber() @IsOptional() ingredient_id?: number;
    @IsString() @IsNotEmpty() item_name: string;
    @IsNumber() @Min(0) quantity: number;
    @IsString() @IsOptional() unit?: string;
    @IsNumber() @Min(0) unit_cost: number;
}

export class CreatePurchaseOrderDto {
    @IsNumber() @IsNotEmpty() supplier_id: number;
    @IsDateString() order_date: string;
    @IsDateString() @IsOptional() expected_date?: string;
    @IsArray() @ValidateNested({ each: true }) @Type(() => PurchaseOrderItemDto)
    items: PurchaseOrderItemDto[];
    @IsString() @IsOptional() notes?: string;
}

export class ReceiveGoodsItemDto {
    @IsNumber() @IsNotEmpty() item_id: number;
    @IsNumber() @Min(0) received_quantity: number;
}

export class ReceiveGoodsDto {
    @IsDateString() received_date: string;
    @IsArray() @ValidateNested({ each: true }) @Type(() => ReceiveGoodsItemDto)
    items: ReceiveGoodsItemDto[];
    @IsString() @IsOptional() notes?: string;
}

export class UpdatePOStatusDto {
    @IsEnum(PurchaseOrderStatus) status: PurchaseOrderStatus;
}
