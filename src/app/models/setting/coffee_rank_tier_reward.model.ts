import {
    BelongsTo,
    Column,
    CreatedAt,
    DataType,
    ForeignKey,
    Model,
    Table,
    UpdatedAt,
} from 'sequelize-typescript';
import CoffeeRankTier from './coffee_rank_tier.model';
import Menu from '@app/models/menu/menu.model';

export enum RankRewardType {
    COUPON = 'coupon',
    ITEM   = 'item',
}

@Table({ tableName: 'coffee_rank_tier_reward', createdAt: 'created_at', updatedAt: 'updated_at' })
export default class CoffeeRankTierReward extends Model<CoffeeRankTierReward> {

    @Column({ primaryKey: true, autoIncrement: true })
    id: number;

    @ForeignKey(() => CoffeeRankTier)
    @Column({ allowNull: false, type: DataType.INTEGER })
    tier_id: number;

    @Column({ allowNull: false, type: DataType.ENUM(...Object.values(RankRewardType)) })
    type: RankRewardType;

    @Column({ allowNull: false, type: DataType.STRING(200) })
    label: string;

    @Column({ allowNull: true, type: DataType.TEXT })
    description: string | null;

    /** For coupon type: discount percentage (e.g. 10.00 = 10%) */
    @Column({ allowNull: true, type: DataType.DECIMAL(5, 2) })
    coupon_discount_percent: number | null;

    /** For coupon type: how many days until the issued coupon expires (null = no expiry) */
    @Column({ allowNull: true, type: DataType.INTEGER })
    coupon_expires_days: number | null;

    /** For item type: which menu item to give */
    @ForeignKey(() => Menu)
    @Column({ allowNull: true, type: DataType.INTEGER })
    menu_id: number | null;

    /** For item type: how many units of the item */
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 1 })
    quantity: number;

    @Column({ allowNull: false, type: DataType.BOOLEAN, defaultValue: true })
    is_active: boolean;

    @BelongsTo(() => CoffeeRankTier, { foreignKey: 'tier_id', as: 'tier' })
    tier: CoffeeRankTier;

    @BelongsTo(() => Menu, { foreignKey: 'menu_id', as: 'menu' })
    menu: Menu;

    @CreatedAt
    @Column({ type: DataType.DATE })
    created_at: Date;

    @UpdatedAt
    @Column({ type: DataType.DATE })
    updated_at: Date;
}
