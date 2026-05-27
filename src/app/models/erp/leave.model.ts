import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import ErpEmployee from './employee.model';
import User from '@app/models/user/user.model';

export enum LeaveType {
    ANNUAL    = 'annual',
    SICK      = 'sick',
    UNPAID    = 'unpaid',
    MATERNITY = 'maternity',
    PATERNITY = 'paternity',
    OTHER     = 'other',
}

export enum LeaveStatus {
    PENDING  = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
    CANCELLED = 'cancelled',
}

@Table({ tableName: 'erp_leaves', createdAt: 'created_at', updatedAt: 'updated_at' })
class ErpLeave extends Model<ErpLeave> {

    @Column({ primaryKey: true, autoIncrement: true })
    id: number;

    @ForeignKey(() => ErpEmployee)
    @Column({ allowNull: false, type: DataType.INTEGER, onDelete: 'CASCADE' })
    employee_id: number;

    @Column({
        allowNull: false,
        type: DataType.ENUM(...Object.values(LeaveType)),
        defaultValue: LeaveType.ANNUAL,
    })
    type: LeaveType;

    @Column({ allowNull: false, type: DataType.DATEONLY })
    start_date: string;

    @Column({ allowNull: false, type: DataType.DATEONLY })
    end_date: string;

    /** Total leave days requested */
    @Column({ allowNull: false, type: DataType.DECIMAL(5, 1), defaultValue: 1 })
    days: number;

    @Column({ allowNull: true, type: DataType.TEXT })
    reason?: string;

    @Column({
        allowNull: false,
        type: DataType.ENUM(...Object.values(LeaveStatus)),
        defaultValue: LeaveStatus.PENDING,
    })
    status: LeaveStatus;

    @ForeignKey(() => User)
    @Column({ allowNull: true, type: DataType.INTEGER })
    approved_by?: number;

    @Column({ allowNull: true, type: DataType.TEXT })
    rejection_reason?: string;

    created_at: Date;
    updated_at: Date;

    @BelongsTo(() => ErpEmployee)
    employee: ErpEmployee;

    @BelongsTo(() => User, 'approved_by')
    approver?: User;
}

export default ErpLeave;
