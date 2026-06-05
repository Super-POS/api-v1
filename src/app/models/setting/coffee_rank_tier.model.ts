import { Column, CreatedAt, DataType, Model, Table, UpdatedAt } from 'sequelize-typescript';

@Table({ tableName: 'coffee_rank_tier', createdAt: 'created_at', updatedAt: 'updated_at' })
export default class CoffeeRankTier extends Model<CoffeeRankTier> {

    @Column({ primaryKey: true, autoIncrement: true })
    id: number;

    @Column({ allowNull: false, unique: true, type: DataType.INTEGER })
    tier: number;

    @Column({ allowNull: false, type: DataType.STRING(200) })
    label: string;

    @Column({ allowNull: false, type: DataType.INTEGER })
    min_points: number;

    @CreatedAt
    @Column({ type: DataType.DATE })
    created_at: Date;

    @UpdatedAt
    @Column({ type: DataType.DATE })
    updated_at: Date;
}
