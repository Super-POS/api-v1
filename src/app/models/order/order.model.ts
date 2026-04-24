// ================================================================================================= Third Party Library
import { BelongsTo, Column, DataType, ForeignKey, HasMany, Model, Table } from 'sequelize-typescript';

// ================================================================================================= Custom Library
import { OrderChannelEnum } from '@app/enums/order-channel.enum';
import { OrderStatusEnum }  from '@app/enums/order-status.enum';
import Notifications        from '@app/models/notification/notification.model';
import User                 from '@app/models/user/user.model';
import OrderDetails         from './detail.model';

@Table({ tableName: 'order', createdAt: 'created_at', updatedAt: 'updated_at' })
class Order extends Model<Order> {

    // ============================================================================================= Primary Key
    @Column({ primaryKey: true, autoIncrement: true })                                              id: number;

    // ============================================================================================= Foreign Key
    @ForeignKey(() => User) @Column({ allowNull: true, onDelete: 'CASCADE' })                       cashier_id?: number;
    @ForeignKey(() => User) @Column({ allowNull: true, onDelete: 'SET NULL' })                      customer_id?: number;

    // ============================================================================================= Field
    @Column({ allowNull: false, unique: true, type: DataType.STRING(10) })                          receipt_number: string;
    @Column({ allowNull: true, type: DataType.DOUBLE })                                             total_price?: number;
    @Column({ allowNull: true, type: DataType.DATE, defaultValue: new Date() })                     ordered_at?: Date;
    @Column({
        allowNull : false,
        type      : DataType.ENUM(...Object.values(OrderChannelEnum)),
        defaultValue: OrderChannelEnum.WALK_IN,
    })
    channel: OrderChannelEnum;

    @Column({
        allowNull : false,
        type      : DataType.ENUM(...Object.values(OrderStatusEnum)),
        defaultValue: OrderStatusEnum.PENDING,
    })
    status: OrderStatusEnum;

    created_at: Date;

    // ============================================================================================= Many to One
    @BelongsTo(() => User, { foreignKey: 'cashier_id', as: 'cashier' })                            cashier?: User;
    @BelongsTo(() => User, { foreignKey: 'customer_id', as: 'customer' })                          customer?: User;

    // ============================================================================================= One to Many
    @HasMany(() => OrderDetails)                                                                    details: OrderDetails[];
    @HasMany(() => Notifications)                                                                   notifications: Notifications[];
}

export default Order;
