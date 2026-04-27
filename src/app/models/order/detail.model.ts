
// ================================================================================================= Third Party Library
import { BelongsTo, Column, DataType, ForeignKey, HasMany, Model, Table } from 'sequelize-typescript';

// ================================================================================================= Custom Library
import Menu from '@app/models/menu/menu.model';
import Order from './order.model';
import OrderDetailModifier from './order-detail-modifier.model';

@Table({ tableName: 'order_details', createdAt: 'created_at', updatedAt: 'updated_at' })
class OrderDetails extends Model<OrderDetails> {

    // ============================================================================================= Primary Key
    @Column({ primaryKey: true, autoIncrement: true })                                              id: number;

    // ============================================================================================= Foreign Key
    @ForeignKey(() => Order) @Column({ onDelete: 'CASCADE' })                                       order_id: number;
    @ForeignKey(() => Menu) @Column({ onDelete: 'CASCADE' })                                     menu_id: number;

    @Column({ allowNull: true, type: DataType.DOUBLE })                                             unit_price?: number;
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                          qty: number;

    /** Free text (e.g. “extra hot”, birthday note) */
    @Column({ allowNull: true, type: DataType.STRING(500) })                                      line_note?: string;
    created_at: Date
    // ============================================================================================= Many to One
    @BelongsTo(() => Order)                                                                         order: Order;
    @BelongsTo(() => Menu)                                                                         menu: Menu;
    // ============================================================================================= One to Many
    @HasMany(() => OrderDetailModifier)                                                            detailModifiers: OrderDetailModifier[];
}

export default OrderDetails;