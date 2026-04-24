// ================================================================================================= Third Party Library
import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';

// ================================================================================================= Custom Library
import Product from './product.model';

@Table({ tableName: 'product_ingredients', createdAt: 'created_at', updatedAt: 'updated_at' })
class ProductIngredient extends Model<ProductIngredient> {

    // ============================================================================================= Primary Key
    @Column({ primaryKey: true, autoIncrement: true })                                              id: number;

    // ============================================================================================= Optional Link (temporarily decoupled)
    @ForeignKey(() => Product)
    @Column({ allowNull: true, type: DataType.INTEGER, onDelete: 'SET NULL' })                      product_id?: number;

    // ============================================================================================= Field
    @Column({ allowNull: false, type: DataType.STRING(150) })                                       name: string;
    @Column({ allowNull: true, type: DataType.STRING(50) })                                         unit?: string;
    @Column({ allowNull: false, type: DataType.DECIMAL(10, 3), defaultValue: 0 })                   quantity: number;
    created_at: Date

    // ===========================================================================================>> Many to One (optional link)
    @BelongsTo(() => Product)                                                                        product?: Product;

}

export default ProductIngredient;
