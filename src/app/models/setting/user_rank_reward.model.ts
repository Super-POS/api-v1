import {
    BelongsTo,
    Column,
    CreatedAt,
    DataType,
    ForeignKey,
    Model,
    Table,
} from 'sequelize-typescript';
import User from '@app/models/user/user.model';
import CoffeeRankTier from './coffee_rank_tier.model';
import CoffeeRankTierReward from './coffee_rank_tier_reward.model';
import Coupon from '@app/models/coupon/coupon.model';
import Menu from '@app/models/menu/menu.model';

export enum UserRankRewardStatus {
    PENDING = 'pending',
    CLAIMED = 'claimed',
    EXPIRED = 'expired',
}

@Table({ tableName: 'user_rank_reward', createdAt: 'created_at', updatedAt: false })
export default class UserRankReward extends Model<UserRankReward> {

    @Column({ primaryKey: true, autoIncrement: true })
    id: number;

    @ForeignKey(() => User)
    @Column({ allowNull: false, type: DataType.INTEGER })
    customer_id: number;

    @ForeignKey(() => CoffeeRankTier)
    @Column({ allowNull: false, type: DataType.INTEGER })
    tier_id: number;

    @ForeignKey(() => CoffeeRankTierReward)
    @Column({ allowNull: false, type: DataType.INTEGER })
    reward_id: number;

    @Column({ allowNull: false, type: DataType.ENUM(...Object.values(UserRankRewardStatus)), defaultValue: UserRankRewardStatus.PENDING })
    status: UserRankRewardStatus;

    /** Auto-generated coupon issued to this user (coupon type only) */
    @ForeignKey(() => Coupon)
    @Column({ allowNull: true, type: DataType.INTEGER })
    issued_coupon_id: number | null;

    @Column({ allowNull: true, type: DataType.DATE })
    claimed_at: Date | null;

    @Column({ allowNull: true, type: DataType.DATE })
    expires_at: Date | null;

    @BelongsTo(() => User, { foreignKey: 'customer_id', as: 'customer' })
    customer: User;

    @BelongsTo(() => CoffeeRankTier, { foreignKey: 'tier_id', as: 'tier' })
    tier: CoffeeRankTier;

    @BelongsTo(() => CoffeeRankTierReward, { foreignKey: 'reward_id', as: 'reward' })
    reward: CoffeeRankTierReward;

    @BelongsTo(() => Coupon, { foreignKey: 'issued_coupon_id', as: 'issued_coupon' })
    issued_coupon: Coupon;

    @BelongsTo(() => Menu, { foreignKey: 'menu_id', as: 'menu_item' })
    menu_item: Menu;

    @CreatedAt
    @Column({ type: DataType.DATE })
    created_at: Date;
}
