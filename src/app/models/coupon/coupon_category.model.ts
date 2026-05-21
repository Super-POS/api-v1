import { BelongsTo, Column, DataType, ForeignKey, Model, Table, Unique } from 'sequelize-typescript';
import MenuType from '@app/models/menu/menu-type.model';

@Table({ tableName: 'coupon_category', createdAt: 'created_at', updatedAt: false })
export default class CouponCategory extends Model<CouponCategory> {
    @Column({ primaryKey: true, autoIncrement: true })
    id: number;

    @Unique('uq_coupon_category')
    @Column({ allowNull: false, type: DataType.INTEGER })
    coupon_id: number;

    @Unique('uq_coupon_category')
    @ForeignKey(() => MenuType)
    @Column({ allowNull: false, type: DataType.INTEGER })
    category_id: number;

    @BelongsTo(() => MenuType, { foreignKey: 'category_id', as: 'category' })
    category: MenuType;

    created_at: Date;
}
