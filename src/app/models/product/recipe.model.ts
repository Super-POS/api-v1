// ================================================================================================= Third Party Library
import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';

// ================================================================================================= Custom Library
import Product from './product.model';
import ProductIngredient from './ingredient.model';

@Table({ tableName: 'product_recipes', createdAt: 'created_at', updatedAt: 'updated_at' })
class ProductRecipe extends Model<ProductRecipe> {

    // ============================================================================================= Primary Key
    @Column({ primaryKey: true, autoIncrement: true })                                              id: number;

    // ============================================================================================= Foreign Key
    @ForeignKey(() => Product)
    @Column({ allowNull: false, type: DataType.INTEGER, onDelete: 'CASCADE' })                      product_id: number;

    @ForeignKey(() => ProductIngredient)
    @Column({ allowNull: false, type: DataType.INTEGER, onDelete: 'CASCADE' })                      ingredient_id: number;

    // ============================================================================================= Field
    @Column({ allowNull: false, type: DataType.DECIMAL(10, 3) })                                    quantity: number;
    created_at: Date

    // ===========================================================================================>> Many to One
    @BelongsTo(() => Product)                                                                        product: Product;
    @BelongsTo(() => ProductIngredient)                                                              ingredient: ProductIngredient;

}

export default ProductRecipe;
