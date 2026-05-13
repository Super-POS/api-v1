// ================================================================================================= Third Party Library
import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';

// ================================================================================================= Custom Library
import { MenuSizeEnum } from '@app/enums/menu-size.enum';
import Menu from './menu.model';

@Table({ tableName: 'menu_sizes', createdAt: 'created_at', updatedAt: 'updated_at' })
class MenuSize extends Model<MenuSize> {

    // ============================================================================================= Primary Key
    @Column({ primaryKey: true, autoIncrement: true })                                    id: number;

    // ============================================================================================= Foreign Key
    @ForeignKey(() => Menu)
    @Column({ allowNull: false, type: DataType.INTEGER, onDelete: 'CASCADE' })            menu_id: number;

    // ============================================================================================= Field
    @Column({ allowNull: false, type: DataType.ENUM(...Object.values(MenuSizeEnum)) })    size: MenuSizeEnum;
    @Column({ allowNull: false, type: DataType.DOUBLE, defaultValue: 0 })                 price: number;

    /** Per-serving ingredient usage for this size. */
    @Column({ allowNull: false, type: DataType.JSON, defaultValue: [] })
    recipes: { ingredient_id: number; quantity: number }[];

    created_at: Date;

    // ===========================================================================================>> Many to One
    @BelongsTo(() => Menu)                                                                menu: Menu;
}

export default MenuSize;
