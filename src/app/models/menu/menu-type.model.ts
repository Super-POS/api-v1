// ================================================================================================= Third Party Library
import { Column, DataType, HasMany, Model, Table } from 'sequelize-typescript';

// ================================================================================================= Custom Library
import Menu from './menu.model';

@Table({ tableName: 'menu_types', createdAt: 'created_at', updatedAt: 'updated_at' })
class MenuType extends Model<MenuType> {

    // ============================================================================================= Primary Key
    @Column({ primaryKey: true, autoIncrement: true })                                              id: number;

    // ============================================================================================= Field
    @Column({ allowNull: false, type: DataType.STRING(100) })                                       name: string;
    @Column({ allowNull: true, type: DataType.STRING(100) })                                        image?: string;
    created_at: Date
    // ===========================================================================================>> One to Many
    @HasMany(() => Menu)                                                                         menus: Menu[];
}

export default MenuType;
