import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ExpenseType } from '@app/models/erp/expense-category.model';

export class CreateExpenseCategoryDto {
    @IsString() @IsNotEmpty() name: string;
    @IsEnum(ExpenseType) @IsOptional() type?: ExpenseType;
    @IsString() @IsOptional() description?: string;
}

export class UpdateExpenseCategoryDto {
    @IsString() @IsOptional() name?: string;
    @IsEnum(ExpenseType) @IsOptional() type?: ExpenseType;
    @IsString() @IsOptional() description?: string;
}

export class CreateExpenseDto {
    @IsNumber() @IsNotEmpty() category_id: number;
    @IsNumber() @Min(0) amount: number;
    @IsString() @IsOptional() currency?: string;
    @IsString() @IsOptional() description?: string;
    @IsDateString() date: string;
    @IsString() @IsOptional() reference?: string;
}

export class PLReportQueryDto {
    @IsDateString() start_date: string;
    @IsDateString() end_date: string;
}
