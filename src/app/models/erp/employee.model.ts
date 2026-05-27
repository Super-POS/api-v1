import { BelongsTo, Column, DataType, ForeignKey, HasMany, Model, Table } from 'sequelize-typescript';
import User from '@app/models/user/user.model';

export enum EmployeeContractType {
    FULL_TIME  = 'full_time',
    PART_TIME  = 'part_time',
    CONTRACT   = 'contract',
    INTERNSHIP = 'internship',
}

export enum EmployeeStatus {
    ACTIVE     = 'active',
    INACTIVE   = 'inactive',
    TERMINATED = 'terminated',
}

@Table({ tableName: 'erp_employees', createdAt: 'created_at', updatedAt: 'updated_at' })
class ErpEmployee extends Model<ErpEmployee> {

    @Column({ primaryKey: true, autoIncrement: true })
    id: number;

    @ForeignKey(() => User)
    @Column({ allowNull: false, type: DataType.INTEGER, onDelete: 'CASCADE' })
    user_id: number;

    @Column({ allowNull: false, type: DataType.STRING(100) })
    position: string;

    @Column({ allowNull: true, type: DataType.STRING(100) })
    department?: string;

    @Column({ allowNull: false, type: DataType.DECIMAL(12, 2), defaultValue: 0 })
    base_salary: number;

    /** Hourly rate used for overtime calculation */
    @Column({ allowNull: false, type: DataType.DECIMAL(12, 2), defaultValue: 0 })
    hourly_rate: number;

    @Column({ allowNull: false, type: DataType.DATEONLY })
    hire_date: string;

    @Column({ allowNull: true, type: DataType.DATEONLY })
    termination_date?: string;

    @Column({
        allowNull: false,
        type: DataType.ENUM(...Object.values(EmployeeContractType)),
        defaultValue: EmployeeContractType.FULL_TIME,
    })
    contract_type: EmployeeContractType;

    @Column({ allowNull: true, type: DataType.STRING(100) })
    bank_account?: string;

    @Column({ allowNull: true, type: DataType.STRING(100) })
    bank_name?: string;

    @Column({
        allowNull: false,
        type: DataType.ENUM(...Object.values(EmployeeStatus)),
        defaultValue: EmployeeStatus.ACTIVE,
    })
    status: EmployeeStatus;

    @Column({ allowNull: true, type: DataType.TEXT })
    notes?: string;

    created_at: Date;
    updated_at: Date;

    @BelongsTo(() => User)
    user: User;
}

export default ErpEmployee;
