// ================================================================================================= Third Party Library
import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';

// ================================================================================================= Custom Library
import Order from '@app/models/order/order.model';
import User  from '@app/models/user/user.model';

export enum CashDrawerLogType {
    DEPOSIT = 'deposit',
    CHANGE = 'change',
    WITHDRAW = 'withdraw',
    RESET = 'reset',
}

@Table({ tableName: 'cash_drawer_log', createdAt: 'created_at', updatedAt: false })
class CashDrawerLog extends Model<CashDrawerLog> {

    // ============================================================================================= Primary Key
    @Column({ primaryKey: true, autoIncrement: true })                                              id: number;

    // ============================================================================================= Foreign Keys
    @ForeignKey(() => User)
    @Column({ allowNull: true, type: DataType.INTEGER, onDelete: 'SET NULL' })                      cashier_id?: number;

    @ForeignKey(() => Order)
    @Column({ allowNull: true, type: DataType.INTEGER, onDelete: 'SET NULL' })                      order_id?: number;

    // ============================================================================================= Fields
    @Column({ allowNull: false, type: DataType.ENUM(...Object.values(CashDrawerLogType)) })         type: CashDrawerLogType;

    // Delta for each USD denomination (positive = added, negative = deducted)
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                          usd_1: number;
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                          usd_5: number;
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                          usd_20: number;
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                          usd_50: number;
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                          usd_100: number;

    // Delta for each KHR denomination
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                          khr_100: number;
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                          khr_200: number;
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                          khr_500: number;
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                          khr_1000: number;
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                          khr_2000: number;
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                          khr_5000: number;
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                          khr_10000: number;
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                          khr_15000: number;
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                          khr_20000: number;
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                          khr_30000: number;
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                          khr_50000: number;
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                          khr_100000: number;
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                          khr_200000: number;

    // Exchange rate used for this transaction (KHR per 1 USD)
    @Column({ allowNull: true, type: DataType.DECIMAL(10, 2) })                                     exchange_rate?: number;

    @Column({ allowNull: true, type: DataType.TEXT })                                               note?: string;

    created_at: Date;

    // ===========================================================================================>> Associations
    @BelongsTo(() => User, { foreignKey: 'cashier_id', as: 'cashier' })                             cashier?: User;
    @BelongsTo(() => Order)                                                                         order?: Order;
}

export default CashDrawerLog;
