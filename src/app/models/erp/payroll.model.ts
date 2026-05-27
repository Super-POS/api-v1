import { BelongsTo, Column, DataType, ForeignKey, HasMany, Model, Table } from 'sequelize-typescript';
import User from '@app/models/user/user.model';
import ErpPayrollItem from './payroll-item.model';

export enum PayrollStatus {
    DRAFT     = 'draft',
    FINALIZED = 'finalized',
    PAID      = 'paid',
}

@Table({ tableName: 'erp_payrolls', createdAt: 'created_at', updatedAt: 'updated_at' })
class ErpPayroll extends Model<ErpPayroll> {

    @Column({ primaryKey: true, autoIncrement: true })
    id: number;

    @Column({ allowNull: false, type: DataType.DATEONLY })
    period_start: string;

    @Column({ allowNull: false, type: DataType.DATEONLY })
    period_end: string;

    @Column({ allowNull: false, type: DataType.DECIMAL(14, 2), defaultValue: 0 })
    total_amount: number;

    @Column({
        allowNull: false,
        type: DataType.ENUM(...Object.values(PayrollStatus)),
        defaultValue: PayrollStatus.DRAFT,
    })
    status: PayrollStatus;

    @ForeignKey(() => User)
    @Column({ allowNull: true, type: DataType.INTEGER })
    created_by?: number;

    @Column({ allowNull: true, type: DataType.TEXT })
    notes?: string;

    created_at: Date;
    updated_at: Date;

    @BelongsTo(() => User, 'created_by')
    creator?: User;

    @HasMany(() => ErpPayrollItem)
    items: ErpPayrollItem[];
}

export default ErpPayroll;
