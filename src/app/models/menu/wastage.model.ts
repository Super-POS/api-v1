// ================================================================================================= Third Party Library
import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';

// ================================================================================================= Custom Library
import User           from '@app/models/user/user.model';
import MenuIngredient from './menu-ingredient.model';

// ─── Shared reason enum ──────────────────────────────────────────────────────
export enum WastageReason {
    EXPIRED    = 'expired',
    DAMAGED    = 'damaged',
    SPOILED    = 'spoiled',
    OVER_COOKED = 'over_cooked',
    OTHER      = 'other',
}

// ─── Ingredient Wastage ───────────────────────────────────────────────────────
@Table({ tableName: 'ingredient_wastages', createdAt: 'created_at', updatedAt: false })
export class IngredientWastage extends Model<IngredientWastage> {

    @Column({ primaryKey: true, autoIncrement: true })                                              id: number;

    @ForeignKey(() => MenuIngredient)
    @Column({ allowNull: false, type: DataType.INTEGER, onDelete: 'CASCADE' })                      ingredient_id: number;

    @ForeignKey(() => User)
    @Column({ allowNull: true, type: DataType.INTEGER, onDelete: 'SET NULL' })                      created_by?: number;

    @Column({ allowNull: false, type: DataType.ENUM(...Object.values(WastageReason)) })             reason: WastageReason;
    @Column({ allowNull: false, type: DataType.DECIMAL(10, 3) })                                    quantity: number;
    @Column({ allowNull: true, type: DataType.STRING(255) })                                        note?: string;

    created_at: Date;

    @BelongsTo(() => MenuIngredient, { foreignKey: 'ingredient_id', as: 'ingredient' })           ingredient: MenuIngredient;
    @BelongsTo(() => User, { foreignKey: 'created_by', as: 'creator' })                             creator?: User;
}

export default IngredientWastage;
