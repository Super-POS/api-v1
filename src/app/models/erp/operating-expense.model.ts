import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import ErpExpenseCategory from './expense-category.model';
import User from '@app/models/user/user.model';

@Table({ tableName: 'erp_operating_expenses', createdAt: 'created_at', updatedAt: false })
class ErpOperatingExpense extends Model<ErpOperatingExpense> {

    @Column({ primaryKey: true, autoIncrement: true })
    id: number;

    @ForeignKey(() => ErpExpenseCategory)
    @Column({ allowNull: false, type: DataType.INTEGER, onDelete: 'RESTRICT' })
    category_id: number;

    @Column({ allowNull: false, type: DataType.DECIMAL(14, 2), defaultValue: 0 })
    amount: number;

    @Column({ allowNull: false, type: DataType.STRING(10), defaultValue: 'USD' })
    currency: string;

    @Column({ allowNull: true, type: DataType.TEXT })
    description?: string;

    @Column({ allowNull: false, type: DataType.DATEONLY })
    date: string;

    /** External invoice / receipt number for audit trail */
    @Column({ allowNull: true, type: DataType.STRING(100) })
    reference?: string;

    @ForeignKey(() => User)
    @Column({ allowNull: true, type: DataType.INTEGER })
    created_by?: number;

    created_at: Date;

    @BelongsTo(() => ErpExpenseCategory)
    category: ErpExpenseCategory;

    @BelongsTo(() => User, 'created_by')
    creator?: User;
}

export default ErpOperatingExpense;
