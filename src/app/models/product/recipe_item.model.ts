// ================================================================================================= Third Party Library
import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';

// ================================================================================================= Custom Library
import Product from './product.model';
import Ingredient from './ingredient.model';

@Table({ tableName: 'recipe_item', createdAt: 'created_at', updatedAt: 'updated_at' })
class RecipeItem extends Model<RecipeItem> {

    // ============================================================================================= Primary Key
    @Column({ primaryKey: true, autoIncrement: true })                                              id: number;

    // ============================================================================================= Foreign Key
    @ForeignKey(() => Product) @Column({ allowNull: false, onDelete: 'CASCADE' })                  product_id: number;
    @ForeignKey(() => Ingredient) @Column({ allowNull: false, onDelete: 'CASCADE' })               ingredient_id: number;

    // ============================================================================================= Field
    @Column({ allowNull: false, type: DataType.DOUBLE })                                            qty_required: number;
    created_at: Date;

    // ===========================================================================================>> Many to One
    @BelongsTo(() => Product)                                                                        product: Product;
    @BelongsTo(() => Ingredient)                                                                     ingredient: Ingredient;
}

export default RecipeItem;
