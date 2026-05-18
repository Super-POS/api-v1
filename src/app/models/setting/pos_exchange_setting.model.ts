import { Column, DataType, Model, Table, UpdatedAt } from 'sequelize-typescript';

@Table({
    tableName: 'pos_exchange_setting',
    createdAt: false,
    updatedAt: 'updated_at',
})
export default class PosExchangeSetting extends Model<PosExchangeSetting> {
    @Column({ primaryKey: true })
    id: number;

    @Column({ allowNull: false, type: DataType.DECIMAL(14, 4), defaultValue: 4100 })
    khr_per_usd: string | number;

    @UpdatedAt
    @Column({ allowNull: false, type: DataType.DATE })
    updated_at: Date;
}
