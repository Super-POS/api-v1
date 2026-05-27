import { Column, DataType, HasMany, Model, Table } from 'sequelize-typescript';
import ErpOperatingExpense from './operating-expense.model';

export enum ExpenseType {
    FIXED    = 'fixed',
    VARIABLE = 'variable',
}

@Table({ tableName: 'erp_expense_categories', timestamps: false })
class ErpExpenseCategory extends Model<ErpExpenseCategory> {

    @Column({ primaryKey: true, autoIncrement: true })
    id: number;

    @Column({ allowNull: false, unique: true, type: DataType.STRING(100) })
    name: string;

    @Column({
        allowNull: false,
        type: DataType.ENUM(...Object.values(ExpenseType)),
        defaultValue: ExpenseType.VARIABLE,
    })
    type: ExpenseType;

    @Column({ allowNull: true, type: DataType.TEXT })
    description?: string;

    @HasMany(() => ErpOperatingExpense)
    expenses: ErpOperatingExpense[];
}

export default ErpExpenseCategory;
