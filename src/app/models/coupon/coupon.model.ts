import { Column, DataType, HasMany, Model, Table } from 'sequelize-typescript';
import CouponAssignedUser from './coupon_assigned_user.model';
import CouponMenu from './coupon_menu.model';
import CouponCategory from './coupon_category.model';

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

    /** Max number of times this coupon can be used globally. NULL = unlimited. */
    @Column({ allowNull: true, type: DataType.INTEGER })
    usage_limit: number | null;

    /** Running count of how many times this coupon has been redeemed. */
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })
    usage_count: number;

    /** Date after which the coupon is no longer valid. NULL = never expires. */
    @Column({ allowNull: true, type: DataType.DATE })
    expires_at: Date | null;

    /** Specific users allowed to redeem. Empty = any user. */
    @HasMany(() => CouponAssignedUser, { foreignKey: 'coupon_id', as: 'assignments' })
    assignments: CouponAssignedUser[];

    /** Specific menus this coupon applies to. Empty = all menus. */
    @HasMany(() => CouponMenu, { foreignKey: 'coupon_id', as: 'menu_restrictions' })
    menu_restrictions: CouponMenu[];

    /** Specific categories this coupon applies to. Empty = all categories. */
    @HasMany(() => CouponCategory, { foreignKey: 'coupon_id', as: 'category_restrictions' })
    category_restrictions: CouponCategory[];

    created_at: Date;
    updated_at: Date;
}
