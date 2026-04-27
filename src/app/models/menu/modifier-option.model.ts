// ================================================================================================= Third Party Library
import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';

// ================================================================================================= Custom Library
import ModifierGroup from './modifier-group.model';

@Table({ tableName: 'modifier_options', createdAt: 'created_at', updatedAt: 'updated_at' })
class ModifierOption extends Model<ModifierOption> {
    @Column({ primaryKey: true, autoIncrement: true })                                              id: number;

    @ForeignKey(() => ModifierGroup)
    @Column({ allowNull: false, type: DataType.INTEGER, onDelete: 'CASCADE' })                     group_id: number;

    /** Shown on ticket / POS (e.g. "50%", "No ice") */
    @Column({ allowNull: false, type: DataType.STRING(120) })                                     label: string;

    /** Optional code for reporting */
    @Column({ allowNull: true, type: DataType.STRING(80) })                                       code?: string;

    /** Added to menu line base price (per unit) */
    @Column({ allowNull: false, type: DataType.DECIMAL(12, 2), defaultValue: 0 })                price_delta: number;

    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                        sort_order: number;

    @Column({ allowNull: false, type: DataType.BOOLEAN, defaultValue: true })                     is_active: boolean;

    /** Suggested default when cashier does not pick (optional UX) */
    @Column({ allowNull: false, type: DataType.BOOLEAN, defaultValue: false })                    is_default: boolean;

    /**
     * Extra ingredients consumed per 1 line unit when this option is selected (in addition to the menu’s `recipes`).
     * Same shape as `menus.recipes`: { ingredient_id, quantity }.
     */
    @Column({ allowNull: false, type: DataType.JSON, defaultValue: [] })
    ingredient_recipe: { ingredient_id: number; quantity: number }[];

    created_at: Date;

    @BelongsTo(() => ModifierGroup)                                                               group: ModifierGroup;
}

export default ModifierOption;
