import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Op } from 'sequelize';
import ErpEmployee from '@app/models/erp/employee.model';
import ErpAttendance, { AttendanceStatus } from '@app/models/erp/attendance.model';
import ErpLeave, { LeaveStatus, LeaveType } from '@app/models/erp/leave.model';
import ErpPayroll, { PayrollStatus } from '@app/models/erp/payroll.model';
import ErpPayrollItem from '@app/models/erp/payroll-item.model';
import User from '@app/models/user/user.model';
import { AttendanceQueryDto, CreateEmployeeDto, CreateLeaveDto, GeneratePayrollDto, MarkAttendanceDto, UpdateEmployeeDto, UpdateLeaveStatusDto } from './dto';

@Injectable()
export class PayrollService {

    private _serializePayroll(p: ErpPayroll) {
        const json = typeof (p as any).toJSON === 'function' ? (p as any).toJSON() : p;
        return { ...json, total_net_salary: Number(json.total_amount ?? 0) };
    }

    // ─── Employees ────────────────────────────────────────────────────────────

    async getEmployees() {
        const rows = await ErpEmployee.findAll({
            include: [{ model: User, attributes: ['id', 'name', 'phone', 'email', 'avatar'] }],
            order: [['created_at', 'DESC']],
        });
        return { data: rows };
    }

    async getEmployee(id: number) {
        const emp = await ErpEmployee.findByPk(id, {
            include: [{ model: User, attributes: ['id', 'name', 'phone', 'email', 'avatar'] }],
        });
        if (!emp) throw new NotFoundException('Employee not found.');
        return { data: emp };
    }

    async createEmployee(dto: CreateEmployeeDto) {
        const user = await User.findByPk(dto.user_id, { attributes: ['id', 'name'] });
        if (!user) throw new BadRequestException('User not found.');

        const existing = await ErpEmployee.findOne({ where: { user_id: dto.user_id } });
        if (existing) throw new BadRequestException('This user is already an employee.');

        const emp = await ErpEmployee.create({ ...dto } as any);
        return { data: emp, message: 'Employee created.' };
    }

    async updateEmployee(id: number, dto: UpdateEmployeeDto) {
        const emp = await ErpEmployee.findByPk(id);
        if (!emp) throw new NotFoundException('Employee not found.');
        await emp.update(dto as any);
        const updated = await emp.reload({ include: [User] });
        return { data: updated, message: 'Employee updated.' };
    }

    async deleteEmployee(id: number) {
        const emp = await ErpEmployee.findByPk(id);
        if (!emp) throw new NotFoundException('Employee not found.');
        await emp.destroy();
        return { message: 'Employee removed.' };
    }

    // ─── Attendance ───────────────────────────────────────────────────────────

    async getAttendance(query: AttendanceQueryDto) {
        const where: any = {};
        if (query.employee_id) where.employee_id = query.employee_id;
        if (query.start_date && query.end_date) {
            where.date = { [Op.between]: [query.start_date, query.end_date] };
        } else if (query.start_date) {
            where.date = { [Op.gte]: query.start_date };
        }
        const rows = await ErpAttendance.findAll({
            where,
            include: [{
                model: ErpEmployee,
                include: [{ model: User, attributes: ['id', 'name'] }],
            }],
            order: [['date', 'DESC']],
        });
        return { data: rows };
    }

    async markAttendance(dto: MarkAttendanceDto) {
        const emp = await ErpEmployee.findByPk(dto.employee_id);
        if (!emp) throw new NotFoundException('Employee not found.');

        let hoursWorked = 0;
        if (dto.clock_in && dto.clock_out) {
            const [inH, inM] = dto.clock_in.split(':').map(Number);
            const [outH, outM] = dto.clock_out.split(':').map(Number);
            hoursWorked = Math.max(0, (outH * 60 + outM - inH * 60 - inM) / 60);
        }

        const existing = await ErpAttendance.findOne({
            where: { employee_id: dto.employee_id, date: dto.date },
        });

        if (existing) {
            await existing.update({
                clock_in       : dto.clock_in,
                clock_out      : dto.clock_out,
                hours_worked   : hoursWorked,
                overtime_hours : dto.overtime_hours ?? 0,
                status         : dto.status,
                notes          : dto.notes,
            });
            return { data: existing, message: 'Attendance updated.' };
        }

        const row = await ErpAttendance.create({
            employee_id    : dto.employee_id,
            date           : dto.date,
            clock_in       : dto.clock_in,
            clock_out      : dto.clock_out,
            hours_worked   : hoursWorked,
            overtime_hours : dto.overtime_hours ?? 0,
            status         : dto.status,
            notes          : dto.notes,
        } as any);
        return { data: row, message: 'Attendance recorded.' };
    }

    // ─── Leaves ───────────────────────────────────────────────────────────────

    async getLeaves(employee_id?: number, status?: LeaveStatus) {
        const where: any = {};
        if (employee_id) where.employee_id = employee_id;
        if (status) where.status = status;
        const rows = await ErpLeave.findAll({
            where,
            include: [{
                model: ErpEmployee,
                include: [{ model: User, attributes: ['id', 'name'] }],
            }],
            order: [['created_at', 'DESC']],
        });
        return { data: rows };
    }

    async createLeave(dto: CreateLeaveDto) {
        const emp = await ErpEmployee.findByPk(dto.employee_id);
        if (!emp) throw new NotFoundException('Employee not found.');

        const overlap = await ErpLeave.findOne({
            where: {
                employee_id : dto.employee_id,
                status      : { [Op.in]: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
                [Op.or]: [
                    { start_date: { [Op.between]: [dto.start_date, dto.end_date] } },
                    { end_date:   { [Op.between]: [dto.start_date, dto.end_date] } },
                ],
            },
        });
        if (overlap) throw new BadRequestException('Leave dates overlap with an existing leave request.');

        const row = await ErpLeave.create({ ...dto, status: LeaveStatus.PENDING } as any);
        return { data: row, message: 'Leave request submitted.' };
    }

    async updateLeaveStatus(id: number, dto: UpdateLeaveStatusDto, approver_id: number) {
        const leave = await ErpLeave.findByPk(id);
        if (!leave) throw new NotFoundException('Leave request not found.');
        if (leave.status !== LeaveStatus.PENDING) {
            throw new BadRequestException('Only pending leaves can be updated.');
        }
        await leave.update({ ...dto, approved_by: approver_id } as any);
        return { data: leave, message: 'Leave status updated.' };
    }

    // ─── Payroll ──────────────────────────────────────────────────────────────

    async getPayrolls() {
        const rows = await ErpPayroll.findAll({
            include: [ErpPayrollItem],
            order: [['period_start', 'DESC']],
        });
        return { data: rows.map(r => this._serializePayroll(r)) };
    }

    async getPayroll(id: number) {
        const payroll = await ErpPayroll.findByPk(id, {
            include: [{
                model: ErpPayrollItem,
                include: [{
                    model: ErpEmployee,
                    include: [{ model: User, attributes: ['id', 'name'] }],
                }],
            }],
        });
        if (!payroll) throw new NotFoundException('Payroll not found.');
        return { data: this._serializePayroll(payroll) };
    }

    /**
     * Auto-generate payroll for all active employees.
     *
     * Formula per employee:
     *   overtime_pay   = overtime_hours × hourly_rate × 1.5
     *   leave_deduction= (unpaid_leave_days / working_days) × base_salary
     *   net_salary     = base_salary + overtime_pay − leave_deduction − other_deductions
     */
    async generatePayroll(dto: GeneratePayrollDto, creator_id: number) {
        const employees = await ErpEmployee.findAll({ where: { status: 'active' } });
        if (!employees.length) throw new BadRequestException('No active employees found.');

        const start = dto.period_start;
        const end   = dto.period_end;

        // Calculate working days in period (Mon–Sat = 6-day week, adjust as needed)
        const msPerDay    = 86_400_000;
        const totalDays   = Math.round((new Date(end).getTime() - new Date(start).getTime()) / msPerDay) + 1;
        const workingDays = Math.ceil((totalDays * 6) / 7); // approximate

        const transaction = await ErpPayroll.sequelize.transaction();
        try {
            const payroll = await ErpPayroll.create({
                period_start : start,
                period_end   : end,
                status       : PayrollStatus.DRAFT,
                created_by   : creator_id,
                notes        : dto.notes,
                total_amount : 0,
            } as any, { transaction });

            let grandTotal = 0;

            for (const emp of employees) {
                // Attendance in period
                const attendance = await ErpAttendance.findAll({
                    where: {
                        employee_id : emp.id,
                        date        : { [Op.between]: [start, end] },
                    },
                    transaction,
                });

                const attendedDays    = attendance.filter(a => a.status === AttendanceStatus.PRESENT || a.status === AttendanceStatus.LATE).length;
                const totalOvertimeH  = attendance.reduce((s, a) => s + Number(a.overtime_hours), 0);

                // Unpaid leave in period
                const unpaidLeaves = await ErpLeave.findAll({
                    where: {
                        employee_id : emp.id,
                        status      : LeaveStatus.APPROVED,
                        type        : LeaveType.UNPAID,
                        start_date  : { [Op.gte]: start },
                        end_date    : { [Op.lte]: end },
                    },
                    transaction,
                });
                const unpaidLeaveDays = unpaidLeaves.reduce((s, l) => s + Number(l.days), 0);

                const overtimePay      = totalOvertimeH * Number(emp.hourly_rate) * 1.5;
                const leaveDeduction   = workingDays > 0 ? (unpaidLeaveDays / workingDays) * Number(emp.base_salary) : 0;
                const netSalary        = Number(emp.base_salary) + overtimePay - leaveDeduction;

                grandTotal += netSalary;

                await ErpPayrollItem.create({
                    payroll_id       : payroll.id,
                    employee_id      : emp.id,
                    base_salary      : emp.base_salary,
                    overtime_hours   : totalOvertimeH,
                    overtime_pay     : overtimePay,
                    working_days     : workingDays,
                    attended_days    : attendedDays,
                    leave_days       : unpaidLeaveDays,
                    leave_deduction  : leaveDeduction,
                    other_deductions : 0,
                    net_salary       : netSalary,
                } as any, { transaction });
            }

            await payroll.update({ total_amount: grandTotal }, { transaction });
            await transaction.commit();

            const result = await this.getPayroll(payroll.id);
            return { ...result, message: 'Payroll generated.' };
        } catch (e) {
            await transaction.rollback();
            throw e;
        }
    }

    async finalizePayroll(id: number) {
        const payroll = await ErpPayroll.findByPk(id);
        if (!payroll) throw new NotFoundException('Payroll not found.');
        if (payroll.status !== PayrollStatus.DRAFT) {
            throw new BadRequestException('Only draft payrolls can be finalized.');
        }
        await payroll.update({ status: PayrollStatus.FINALIZED });
        return { message: 'Payroll finalized.' };
    }

    async markPayrollPaid(id: number) {
        const payroll = await ErpPayroll.findByPk(id);
        if (!payroll) throw new NotFoundException('Payroll not found.');
        if (payroll.status !== PayrollStatus.FINALIZED) {
            throw new BadRequestException('Only finalized payrolls can be marked as paid.');
        }
        await payroll.update({ status: PayrollStatus.PAID });
        return { message: 'Payroll marked as paid.' };
    }
}
