// ================================================================================================= Third Party Library
import { Column, DataType, HasMany, Model, Table } from 'sequelize-typescript';

// ================================================================================================= Custom Library
import RecipeItem from './recipe_item.model';

@Table({ tableName: 'ingredient', createdAt: 'created_at', updatedAt: 'updated_at' })
class Ingredient extends Model<Ingredient> {

    // ============================================================================================= Primary Key
    @Column({ primaryKey: true, autoIncrement: true })                                              id: number;

    // ============================================================================================= Field
    @Column({ allowNull: false, unique: true, type: DataType.STRING(100) })                         name: string;
    @Column({ allowNull: false, type: DataType.STRING(20), defaultValue: 'unit' })                  unit: string;
    @Column({ allowNull: false, type: DataType.DOUBLE, defaultValue: 0 })                            stock: number;
    @Column({ allowNull: false, type: DataType.DOUBLE, defaultValue: 0 })                            low_stock_threshold: number;
    created_at: Date;

    // ===========================================================================================>> One to Many
    @HasMany(() => RecipeItem)                                                                        recipe_items: RecipeItem[];
}

export default Ingredient;
