
// ================================================================================================= Third Party Library
import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';

// ================================================================================================= Custom Library
import Menu from '@app/models/menu/menu.model';
import Order from './order.model';

@Table({ tableName: 'order_details', createdAt: 'created_at', updatedAt: 'updated_at' })
class OrderDetails extends Model<OrderDetails> {

    // ============================================================================================= Primary Key
    @Column({ primaryKey: true, autoIncrement: true })                                              id: number;

    // ============================================================================================= Foreign Key
    @ForeignKey(() => Order) @Column({ onDelete: 'CASCADE' })                                       order_id: number;
    @ForeignKey(() => Menu) @Column({ onDelete: 'CASCADE' })                                     menu_id: number;

    @Column({ allowNull: true, type: DataType.DOUBLE })                                             unit_price?: number;
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                          qty: number;
    created_at: Date
    // ============================================================================================= Many to One
    @BelongsTo(() => Order)                                                                         order: Order;
    @BelongsTo(() => Menu)                                                                         menu: Menu;
}

export default OrderDetails;