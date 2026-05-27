import { BelongsTo, Column, DataType, ForeignKey, HasMany, Model, Table } from 'sequelize-typescript';
import ErpSupplier from './supplier.model';
import User from '@app/models/user/user.model';
import ErpPurchaseOrderItem from './purchase-order-item.model';

export enum PurchaseOrderStatus {
    DRAFT     = 'draft',
    ORDERED   = 'ordered',
    PARTIAL   = 'partial',
    RECEIVED  = 'received',
    CANCELLED = 'cancelled',
}

@Table({ tableName: 'erp_purchase_orders', createdAt: 'created_at', updatedAt: 'updated_at' })
class ErpPurchaseOrder extends Model<ErpPurchaseOrder> {

    @Column({ primaryKey: true, autoIncrement: true })
    id: number;

    @Column({ allowNull: false, unique: true, type: DataType.STRING(50) })
    po_number: string;

    @ForeignKey(() => ErpSupplier)
    @Column({ allowNull: false, type: DataType.INTEGER, onDelete: 'RESTRICT' })
    supplier_id: number;

    @Column({ allowNull: false, type: DataType.DATEONLY })
    order_date: string;

    @Column({ allowNull: true, type: DataType.DATEONLY })
    expected_date?: string;

    @Column({ allowNull: true, type: DataType.DATEONLY })
    received_date?: string;

    /** Purchase Total = Σ(Item Cost × Quantity) */
    @Column({ allowNull: false, type: DataType.DECIMAL(14, 2), defaultValue: 0 })
    total_amount: number;

    @Column({
        allowNull: false,
        type: DataType.ENUM(...Object.values(PurchaseOrderStatus)),
        defaultValue: PurchaseOrderStatus.DRAFT,
    })
    status: PurchaseOrderStatus;

    @ForeignKey(() => User)
    @Column({ allowNull: true, type: DataType.INTEGER })
    created_by?: number;

    @Column({ allowNull: true, type: DataType.TEXT })
    notes?: string;

    created_at: Date;
    updated_at: Date;

    @BelongsTo(() => ErpSupplier)
    supplier: ErpSupplier;

    @BelongsTo(() => User, 'created_by')
    creator?: User;

    @HasMany(() => ErpPurchaseOrderItem)
    items: ErpPurchaseOrderItem[];
}

export default ErpPurchaseOrder;
