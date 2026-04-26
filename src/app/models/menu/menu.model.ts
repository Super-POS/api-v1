// ================================================================================================= Third Party Library
import { BelongsTo, Column, DataType, ForeignKey, HasMany, Model, Table } from 'sequelize-typescript';

// ================================================================================================= Custom Library
import OrderDetails from '@app/models/order/detail.model';
import User from '@app/models/user/user.model';
import MenuType from './menu-type.model';
import MenuIngredient from './menu-ingredient.model';

@Table({ tableName: 'menus', createdAt: 'created_at', updatedAt: 'updated_at' })
class Menu extends Model<Menu> {

    // ============================================================================================= Primary Key
    @Column({ primaryKey: true, autoIncrement: true })                                              id: number;

    // ============================================================================================= Foreign Key
    @ForeignKey(() => MenuType) @Column({ onDelete: 'RESTRICT' })                               type_id: number;
    @ForeignKey(() => User) @Column({ onDelete: 'CASCADE' })                                        creator_id: number;

    // ============================================================================================= Field
    @Column({ allowNull: false, unique: true, type: DataType.STRING(100) })                         code: string;
    @Column({ allowNull: false, type: DataType.STRING(100) })                                       name: string;
    @Column({ allowNull: true, type: DataType.STRING(100) })                                        image?: string;
    @Column({ allowNull: true, type: DataType.DOUBLE })                                             unit_price?: number;

    @Column({ allowNull: false, type: DataType.DECIMAL(10, 2), defaultValue: 0 })                   discount: number;

    /** Per-serving ingredient usage. Stock is deducted on order. */
    @Column({ allowNull: false, type: DataType.JSON, defaultValue: [] })
    recipes: { ingredient_id: number; quantity: number }[];

    created_at: Date
    // ===========================================================================================>> Many to One
    @BelongsTo(() => MenuType)                                                                  type: MenuType;
    @BelongsTo(() => User)                                                                          creator: User;

    // ===========================================================================================>> One to Many
    @HasMany(() => OrderDetails)                                                                    orderDetails: OrderDetails[];
    @HasMany(() => MenuIngredient)                                                                 ingredients: MenuIngredient[];
}

export default Menu;
