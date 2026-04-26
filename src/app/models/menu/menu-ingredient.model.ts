// ================================================================================================= Third Party Library
import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';

// ================================================================================================= Custom Library
import Menu from './menu.model';

@Table({ tableName: 'menu_ingredients', createdAt: 'created_at', updatedAt: 'updated_at' })
class MenuIngredient extends Model<MenuIngredient> {

    // ============================================================================================= Primary Key
    @Column({ primaryKey: true, autoIncrement: true })                                              id: number;

    // ============================================================================================= Optional link to a menu
    @ForeignKey(() => Menu)
    @Column({ allowNull: true, type: DataType.INTEGER, onDelete: 'SET NULL' })                      menu_id?: number;

    // ============================================================================================= Field
    @Column({ allowNull: false, type: DataType.STRING(150) })                                       name: string;
    @Column({ allowNull: true, type: DataType.STRING(50) })                                         unit?: string;
    @Column({ allowNull: false, type: DataType.DECIMAL(10, 3), defaultValue: 0 })                   quantity: number;
    @Column({ allowNull: false, type: DataType.DECIMAL(12, 4), defaultValue: 0, comment: 'Cost per unit of this ingredient (for COGS calculation)' })
    unit_cost: number;
    created_at: Date

    // ===========================================================================================>> Many to One
    @BelongsTo(() => Menu)                                                                        menu?: Menu;

}

export default MenuIngredient;
