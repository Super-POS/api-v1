import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import ErpPayroll from './payroll.model';
import ErpEmployee from './employee.model';

@Table({ tableName: 'erp_payroll_items', createdAt: 'created_at', updatedAt: false })
class ErpPayrollItem extends Model<ErpPayrollItem> {

    @Column({ primaryKey: true, autoIncrement: true })
    id: number;

    @ForeignKey(() => ErpPayroll)
    @Column({ allowNull: false, type: DataType.INTEGER, onDelete: 'CASCADE' })
    payroll_id: number;

    @ForeignKey(() => ErpEmployee)
    @Column({ allowNull: false, type: DataType.INTEGER, onDelete: 'CASCADE' })
    employee_id: number;

    @Column({ allowNull: false, type: DataType.DECIMAL(12, 2), defaultValue: 0 })
    base_salary: number;

    @Column({ allowNull: false, type: DataType.DECIMAL(5, 2), defaultValue: 0 })
    overtime_hours: number;

    /** overtime_hours × hourly_rate × 1.5 */
    @Column({ allowNull: false, type: DataType.DECIMAL(12, 2), defaultValue: 0 })
    overtime_pay: number;

    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })
    working_days: number;

    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })
    attended_days: number;

    @Column({ allowNull: false, type: DataType.DECIMAL(5, 1), defaultValue: 0 })
    leave_days: number;

    /** Salary deducted for unpaid/excess leave */
    @Column({ allowNull: false, type: DataType.DECIMAL(12, 2), defaultValue: 0 })
    leave_deduction: number;

    /** Other deductions (tax, advances, etc.) */
    @Column({ allowNull: false, type: DataType.DECIMAL(12, 2), defaultValue: 0 })
    other_deductions: number;

    /** Final Salary = base_salary + overtime_pay - leave_deduction - other_deductions */
    @Column({ allowNull: false, type: DataType.DECIMAL(12, 2), defaultValue: 0 })
    net_salary: number;

    @Column({ allowNull: true, type: DataType.TEXT })
    notes?: string;

    created_at: Date;

    @BelongsTo(() => ErpPayroll)
    payroll: ErpPayroll;

    @BelongsTo(() => ErpEmployee)
    employee: ErpEmployee;
}

export default ErpPayrollItem;
