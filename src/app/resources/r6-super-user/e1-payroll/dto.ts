import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import { AttendanceStatus } from '@app/models/erp/attendance.model';
import { EmployeeContractType, EmployeeStatus } from '@app/models/erp/employee.model';
import { LeaveStatus, LeaveType } from '@app/models/erp/leave.model';
import { Type } from 'class-transformer';

export class CreateEmployeeDto {
    @IsNumber() @IsNotEmpty() user_id: number;
    @IsString() @IsNotEmpty() position: string;
    @IsString() @IsOptional() department?: string;
    @IsNumber() @IsPositive() base_salary: number;
    @IsNumber() @Min(0) hourly_rate: number;
    @IsDateString() hire_date: string;
    @IsEnum(EmployeeContractType) @IsOptional() contract_type?: EmployeeContractType;
    @IsString() @IsOptional() bank_account?: string;
    @IsString() @IsOptional() bank_name?: string;
    @IsString() @IsOptional() notes?: string;
}

export class UpdateEmployeeDto {
    @IsString() @IsOptional() position?: string;
    @IsString() @IsOptional() department?: string;
    @IsNumber() @IsOptional() base_salary?: number;
    @IsNumber() @IsOptional() hourly_rate?: number;
    @IsEnum(EmployeeContractType) @IsOptional() contract_type?: EmployeeContractType;
    @IsString() @IsOptional() bank_account?: string;
    @IsString() @IsOptional() bank_name?: string;
    @IsEnum(EmployeeStatus) @IsOptional() status?: EmployeeStatus;
    @IsDateString() @IsOptional() termination_date?: string;
    @IsString() @IsOptional() notes?: string;
}

export class MarkAttendanceDto {
    @IsNumber() @IsNotEmpty() employee_id: number;
    @IsDateString() date: string;
    @IsString() @IsOptional() clock_in?: string;
    @IsString() @IsOptional() clock_out?: string;
    @IsNumber() @Min(0) @IsOptional() overtime_hours?: number;
    @IsEnum(AttendanceStatus) status: AttendanceStatus;
    @IsString() @IsOptional() notes?: string;
}

export class CreateLeaveDto {
    @IsNumber() @IsNotEmpty() employee_id: number;
    @IsEnum(LeaveType) type: LeaveType;
    @IsDateString() start_date: string;
    @IsDateString() end_date: string;
    @IsNumber() @IsPositive() days: number;
    @IsString() @IsOptional() reason?: string;
}

export class UpdateLeaveStatusDto {
    @IsEnum(LeaveStatus) status: LeaveStatus;
    @IsString() @IsOptional() rejection_reason?: string;
}

export class GeneratePayrollDto {
    @IsDateString() period_start: string;
    @IsDateString() period_end: string;
    @IsString() @IsOptional() notes?: string;
}

export class AttendanceQueryDto {
    @IsDateString() @IsOptional() start_date?: string;
    @IsDateString() @IsOptional() end_date?: string;
    @Type(() => Number) @IsNumber() @IsOptional() employee_id?: number;
}
