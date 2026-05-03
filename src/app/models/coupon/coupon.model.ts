import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({ tableName: 'coupon', createdAt: 'created_at', updatedAt: 'updated_at' })
export default class Coupon extends Model<Coupon> {
    @Column({ primaryKey: true, autoIncrement: true })
    id: number;

    @Column({ allowNull: false, unique: true, type: DataType.STRING(64) })
    code: string;

    @Column({ allowNull: false, type: DataType.DECIMAL(5, 2) })
    discount_percent: number;

    @Column({ allowNull: false, type: DataType.BOOLEAN, defaultValue: true })
    is_active: boolean;

    @Column({ allowNull: true, type: DataType.TEXT })
    note: string | null;

    created_at: Date;
    updated_at: Date;
}
