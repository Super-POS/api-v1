// ================================================================================================= Third Party Library
import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';

// ================================================================================================= Custom Library
import Menu from './menu.model';
import ModifierGroup from './modifier-group.model';

/**
 * Which modifier groups apply to a given menu, display order, and whether a choice is mandatory.
 */
@Table({ tableName: 'menu_modifier_groups', createdAt: false, updatedAt: false })
class MenuModifierGroup extends Model<MenuModifierGroup> {
    @ForeignKey(() => Menu)
    @Column({ primaryKey: true, type: DataType.INTEGER, onDelete: 'CASCADE' })                    menu_id: number;

    @ForeignKey(() => ModifierGroup)
    @Column({ primaryKey: true, type: DataType.INTEGER, onDelete: 'CASCADE' })                    modifier_group_id: number;

    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                        sort_order: number;

    /** If true, order line must include exactly one option from this group */
    @Column({ allowNull: false, type: DataType.BOOLEAN, defaultValue: false })                   is_required: boolean;

    @BelongsTo(() => Menu)                                                                         menu: Menu;
    @BelongsTo(() => ModifierGroup)                                                                modifierGroup: ModifierGroup;
}

export default MenuModifierGroup;
