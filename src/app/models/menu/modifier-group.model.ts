// ================================================================================================= Third Party Library
import {
    BelongsToMany,
    Column,
    DataType,
    HasMany,
    Model,
    Table,
} from 'sequelize-typescript';

// ================================================================================================= Custom Library
import Menu from './menu.model';
import MenuModifierGroup from './menu-modifier-group.model';
import ModifierOption from './modifier-option.model';

@Table({ tableName: 'modifier_groups', createdAt: 'created_at', updatedAt: 'updated_at' })
class ModifierGroup extends Model<ModifierGroup> {
    @Column({ primaryKey: true, autoIncrement: true })                                              id: number;

    /** Display name (e.g. "Sugar level", "Ice") */
    @Column({ allowNull: false, type: DataType.STRING(120) })                                     name: string;

    /** Stable key for integrations / reporting */
    @Column({ allowNull: false, unique: true, type: DataType.STRING(80) })                         code: string;

    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                        sort_order: number;

    @Column({ allowNull: false, type: DataType.BOOLEAN, defaultValue: true })                      is_active: boolean;

    created_at: Date;

    @HasMany(() => ModifierOption, { as: 'options' })                                              options: ModifierOption[];
    @BelongsToMany(() => Menu, () => MenuModifierGroup)                                            menus: Menu[];
}

export default ModifierGroup;
