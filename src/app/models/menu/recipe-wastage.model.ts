// ================================================================================================= Third Party Library
import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';

// ================================================================================================= Custom Library
import User           from '@app/models/user/user.model';
import Menu           from './menu.model';
import { WastageReason } from './wastage.model';

// ─── Recipe (Menu) Wastage ────────────────────────────────────────────────────
@Table({ tableName: 'recipe_wastages', createdAt: 'created_at', updatedAt: false })
export class RecipeWastage extends Model<RecipeWastage> {

    @Column({ primaryKey: true, autoIncrement: true })                                              id: number;

    @ForeignKey(() => Menu)
    @Column({ allowNull: false, type: DataType.INTEGER, onDelete: 'CASCADE' })                      menu_id: number;

    @ForeignKey(() => User)
    @Column({ allowNull: true, type: DataType.INTEGER, onDelete: 'SET NULL' })                      created_by?: number;

    @Column({ allowNull: false, type: DataType.ENUM(...Object.values(WastageReason)) })             reason: WastageReason;
    /** Number of recipe servings wasted. */
    @Column({ allowNull: false, type: DataType.DECIMAL(10, 3) })                                    quantity: number;
    @Column({ allowNull: true, type: DataType.STRING(255) })                                        note?: string;

    created_at: Date;

    @BelongsTo(() => Menu, { foreignKey: 'menu_id', as: 'menu' })                                 menu: Menu;
    @BelongsTo(() => User, { foreignKey: 'created_by', as: 'creator' })                             creator?: User;
}

export default RecipeWastage;
