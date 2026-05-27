import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import ErpPurchaseOrder from './purchase-order.model';
import MenuIngredient from '@app/models/menu/menu-ingredient.model';

@Table({ tableName: 'erp_purchase_order_items', timestamps: false })
class ErpPurchaseOrderItem extends Model<ErpPurchaseOrderItem> {

    @Column({ primaryKey: true, autoIncrement: true })
    id: number;

    @ForeignKey(() => ErpPurchaseOrder)
    @Column({ allowNull: false, type: DataType.INTEGER, onDelete: 'CASCADE' })
    po_id: number;

    @ForeignKey(() => MenuIngredient)
    @Column({ allowNull: true, type: DataType.INTEGER, onDelete: 'SET NULL' })
    ingredient_id?: number;

    /** Free-text name if ingredient is not yet in the system */
    @Column({ allowNull: false, type: DataType.STRING(150) })
    item_name: string;

    @Column({ allowNull: false, type: DataType.DECIMAL(12, 3), defaultValue: 0 })
    quantity: number;

    @Column({ allowNull: false, type: DataType.DECIMAL(12, 3), defaultValue: 0 })
    received_quantity: number;

    @Column({ allowNull: true, type: DataType.STRING(30) })
    unit?: string;

    /** Unit cost at time of purchase */
    @Column({ allowNull: false, type: DataType.DECIMAL(12, 4), defaultValue: 0 })
    unit_cost: number;

    /** Total = quantity × unit_cost */
    @Column({ allowNull: false, type: DataType.DECIMAL(14, 2), defaultValue: 0 })
    total_cost: number;

    @BelongsTo(() => ErpPurchaseOrder)
    purchaseOrder: ErpPurchaseOrder;

    @BelongsTo(() => MenuIngredient)
    ingredient?: MenuIngredient;
}

export default ErpPurchaseOrderItem;
