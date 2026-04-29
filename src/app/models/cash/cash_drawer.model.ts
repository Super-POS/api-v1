// ================================================================================================= Third Party Library
import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({ tableName: 'cash_drawer', createdAt: 'created_at', updatedAt: 'updated_at' })
class CashDrawer extends Model<CashDrawer> {

    // ============================================================================================= Primary Key
    @Column({ primaryKey: true, autoIncrement: true })                                              id: number;

    // ============================================================================================= USD Denominations (count of bills)
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                          usd_1: number;
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                          usd_5: number;
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                          usd_20: number;
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                          usd_50: number;
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                          usd_100: number;

    // ============================================================================================= KHR Denominations (count of notes)
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

    created_at: Date;
    updated_at: Date;
}

export default CashDrawer;
