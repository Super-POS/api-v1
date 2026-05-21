import { BelongsTo, Column, DataType, ForeignKey, Model, Table, Unique } from 'sequelize-typescript';
import Coupon from './coupon.model';
import User from '@app/models/user/user.model';

@Table({ tableName: 'coupon_usage', createdAt: 'created_at', updatedAt: false })
export default class CouponUsage extends Model<CouponUsage> {
    @Column({ primaryKey: true, autoIncrement: true })
    id: number;

    @Unique('uq_coupon_usage_per_user')
    @ForeignKey(() => Coupon)
    @Column({ allowNull: false, type: DataType.INTEGER })
    coupon_id: number;

    @Unique('uq_coupon_usage_per_user')
    @ForeignKey(() => User)
    @Column({ allowNull: false, type: DataType.INTEGER })
    user_id: number;

    @BelongsTo(() => Coupon)
    coupon: Coupon;

    @BelongsTo(() => User)
    user: User;

    created_at: Date;
}
