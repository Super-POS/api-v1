import { BelongsTo, Column, DataType, ForeignKey, Model, Table, Unique } from 'sequelize-typescript';
import User from '@app/models/user/user.model';

@Table({ tableName: 'coupon_assigned_user', createdAt: 'created_at', updatedAt: false })
export default class CouponAssignedUser extends Model<CouponAssignedUser> {
    @Column({ primaryKey: true, autoIncrement: true })
    id: number;

    @Unique('uq_coupon_assignment')
    @Column({ allowNull: false, type: DataType.INTEGER })
    coupon_id: number;

    @Unique('uq_coupon_assignment')
    @ForeignKey(() => User)
    @Column({ allowNull: false, type: DataType.INTEGER })
    user_id: number;

    @BelongsTo(() => User, { foreignKey: 'user_id', as: 'user' })
    user: User;

    created_at: Date;
}
