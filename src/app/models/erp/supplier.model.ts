import { Column, DataType, HasMany, Model, Table } from 'sequelize-typescript';
import ErpPurchaseOrder from './purchase-order.model';

@Table({ tableName: 'erp_suppliers', createdAt: 'created_at', updatedAt: 'updated_at' })
class ErpSupplier extends Model<ErpSupplier> {

    @Column({ primaryKey: true, autoIncrement: true })
    id: number;

    @Column({ allowNull: false, type: DataType.STRING(150) })
    name: string;

    @Column({ allowNull: true, type: DataType.STRING(100) })
    contact_person?: string;

    @Column({ allowNull: true, type: DataType.STRING(30) })
    phone?: string;

    @Column({ allowNull: true, type: DataType.STRING(150) })
    email?: string;

    @Column({ allowNull: true, type: DataType.TEXT })
    address?: string;

    /** e.g. "Net 30 days", "Cash on delivery" */
    @Column({ allowNull: true, type: DataType.STRING(100) })
    payment_terms?: string;

    @Column({ allowNull: false, type: DataType.BOOLEAN, defaultValue: true })
    is_active: boolean;

    @Column({ allowNull: true, type: DataType.TEXT })
    notes?: string;

    created_at: Date;
    updated_at: Date;

    @HasMany(() => ErpPurchaseOrder)
    purchaseOrders: ErpPurchaseOrder[];
}

export default ErpSupplier;
