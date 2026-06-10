import { Column, CreatedAt, DataType, HasMany, Model, Table, UpdatedAt } from 'sequelize-typescript';
import CoffeeRankTierReward from './coffee_rank_tier_reward.model';

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

    @Column({ allowNull: true, type: DataType.STRING(500) })
    icon: string | null;

    @HasMany(() => CoffeeRankTierReward, { foreignKey: 'tier_id', as: 'rewards' })
    rewards: CoffeeRankTierReward[];

    @CreatedAt
    @Column({ type: DataType.DATE })
    created_at: Date;

    @UpdatedAt
    @Column({ type: DataType.DATE })
    updated_at: Date;
}
