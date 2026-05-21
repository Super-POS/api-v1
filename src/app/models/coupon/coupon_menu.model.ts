import { BelongsTo, Column, DataType, ForeignKey, Model, Table, Unique } from 'sequelize-typescript';
import Menu from '@app/models/menu/menu.model';

@Table({ tableName: 'coupon_menu', createdAt: 'created_at', updatedAt: false })
export default class CouponMenu extends Model<CouponMenu> {
    @Column({ primaryKey: true, autoIncrement: true })
    id: number;

    @Unique('uq_coupon_menu')
    @Column({ allowNull: false, type: DataType.INTEGER })
    coupon_id: number;

    @Unique('uq_coupon_menu')
    @ForeignKey(() => Menu)
    @Column({ allowNull: false, type: DataType.INTEGER })
    menu_id: number;

    @BelongsTo(() => Menu, { foreignKey: 'menu_id', as: 'menu' })
    menu: Menu;

    created_at: Date;
}
