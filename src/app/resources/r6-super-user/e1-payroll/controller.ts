import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import UserDecorator from '@app/core/decorators/user.decorator';
import User from '@app/models/user/user.model';
import { LeaveStatus } from '@app/models/erp/leave.model';
import { PayrollService } from './service';
import {
    AttendanceQueryDto, CreateEmployeeDto, CreateLeaveDto,
    GeneratePayrollDto, MarkAttendanceDto, UpdateEmployeeDto, UpdateLeaveStatusDto,
} from './dto';

@Controller()
export class PayrollController {
    constructor(private readonly _service: PayrollService) {}

    // ─── Employees ────────────────────────────────────────────────────────────

    @Get('employees')
    getEmployees() {
        return this._service.getEmployees();
    }

    @Get('employees/:id')
    getEmployee(@Param('id', ParseIntPipe) id: number) {
        return this._service.getEmployee(id);
    }

    @Post('employees')
    createEmployee(@Body() dto: CreateEmployeeDto) {
        return this._service.createEmployee(dto);
    }

    @Patch('employees/:id')
    updateEmployee(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEmployeeDto) {
        return this._service.updateEmployee(id, dto);
    }

    @Delete('employees/:id')
    deleteEmployee(@Param('id', ParseIntPipe) id: number) {
        return this._service.deleteEmployee(id);
    }

    // ─── Attendance ───────────────────────────────────────────────────────────

    @Get('attendance')
    getAttendance(@Query() query: AttendanceQueryDto) {
        return this._service.getAttendance(query);
    }

    @Post('attendance')
    markAttendance(@Body() dto: MarkAttendanceDto) {
        return this._service.markAttendance(dto);
    }

    // ─── Leaves ───────────────────────────────────────────────────────────────

    @Get('leaves')
    getLeaves(
        @Query('employee_id') employee_id?: number,
        @Query('status') status?: LeaveStatus,
    ) {
        return this._service.getLeaves(employee_id, status);
    }

    @Post('leaves')
    createLeave(@Body() dto: CreateLeaveDto) {
        return this._service.createLeave(dto);
    }

    @Patch('leaves/:id/status')
    updateLeaveStatus(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateLeaveStatusDto,
        @UserDecorator() auth: User,
    ) {
        return this._service.updateLeaveStatus(id, dto, auth.id);
    }

    // ─── Payroll ──────────────────────────────────────────────────────────────

    @Get('payrolls')
    getPayrolls() {
        return this._service.getPayrolls();
    }

    @Get('payrolls/:id')
    getPayroll(@Param('id', ParseIntPipe) id: number) {
        return this._service.getPayroll(id);
    }

    @Post('payrolls/generate')
    generatePayroll(@Body() dto: GeneratePayrollDto, @UserDecorator() auth: User) {
        return this._service.generatePayroll(dto, auth.id);
    }

    @Patch('payrolls/:id/finalize')
    finalizePayroll(@Param('id', ParseIntPipe) id: number) {
        return this._service.finalizePayroll(id);
    }

    @Patch('payrolls/:id/mark-paid')
    markPayrollPaid(@Param('id', ParseIntPipe) id: number) {
        return this._service.markPayrollPaid(id);
    }
}
