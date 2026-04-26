// ================================================================================================= Third Party Library
import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';

// ================================================================================================= Custom Library
import User from '@app/models/user/user.model';
import MenuIngredient from './menu-ingredient.model';

export enum StockMovementType {
    IN  = 'in',
    OUT = 'out',
}

@Table({ tableName: 'ingredient_stock_movements', createdAt: 'created_at', updatedAt: 'updated_at' })
class IngredientStockMovement extends Model<IngredientStockMovement> {

    // ============================================================================================= Primary Key
    @Column({ primaryKey: true, autoIncrement: true })                                              id: number;

    // ============================================================================================= Foreign Key
    @ForeignKey(() => MenuIngredient)
    @Column({ allowNull: false, type: DataType.INTEGER, onDelete: 'CASCADE' })                      ingredient_id: number;

    @ForeignKey(() => User)
    @Column({ allowNull: true, type: DataType.INTEGER, onDelete: 'SET NULL' })                      created_by?: number;

    // ============================================================================================= Field
    @Column({ allowNull: false, type: DataType.ENUM(...Object.values(StockMovementType)) })         type: StockMovementType;
    @Column({ allowNull: false, type: DataType.DECIMAL(10, 3) })                                    quantity: number;
    @Column({ allowNull: true, type: DataType.STRING(255) })                                        note?: string;
    created_at: Date

    // ===========================================================================================>> Many to One
    @BelongsTo(() => MenuIngredient)                                                              ingredient: MenuIngredient;
    @BelongsTo(() => User, { foreignKey: 'created_by', as: 'creator' })                             creator?: User;

}

export default IngredientStockMovement;
