// ================================================================================================= Third Party Library
import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';

// ================================================================================================= Custom Library
import Order from '@app/models/order/order.model';
import User  from '@app/models/user/user.model';

export enum PaymentMethod {
    CASH   = 'cash',
    WALLET = 'wallet',
    CARD   = 'card',
    QR     = 'qr',
}

export enum PaymentStatus {
    PENDING = 'pending',
    SUCCESS = 'success',
    FAILED  = 'failed',
    EXPIRED = 'expired',
}

@Table({ tableName: 'payment_transaction', createdAt: 'created_at', updatedAt: 'updated_at' })
class PaymentTransaction extends Model<PaymentTransaction> {

    // ============================================================================================= Primary Key
    @Column({ primaryKey: true, autoIncrement: true })                                              id: number;

    // ============================================================================================= Foreign Key
    @ForeignKey(() => Order)
    @Column({ allowNull: false, type: DataType.INTEGER, onDelete: 'CASCADE' })                      order_id: number;

    @ForeignKey(() => User)
    @Column({ allowNull: true, type: DataType.INTEGER, onDelete: 'SET NULL' })                      customer_id?: number;

    @ForeignKey(() => User)
    @Column({ allowNull: true, type: DataType.INTEGER, onDelete: 'SET NULL' })                      processed_by?: number;

    // ============================================================================================= Field
    @Column({ allowNull: false, type: DataType.ENUM(...Object.values(PaymentMethod)) })             method: PaymentMethod;

    @Column({
        allowNull    : false,
        type         : DataType.ENUM(...Object.values(PaymentStatus)),
        defaultValue : PaymentStatus.PENDING,
    })
    status: PaymentStatus;

    @Column({ allowNull: false, type: DataType.DECIMAL(12, 2) })                                    amount: number;
    @Column({ allowNull: true, type: DataType.STRING(100) })                                        reference?: string;
    @Column({ allowNull: true, type: DataType.TEXT })                                               note?: string;

    // Timestamp when payment was confirmed (success/failed/expired)
    @Column({ allowNull: true, type: DataType.DATE })                                               paid_at?: Date;

    // For QR / online payments: when the pending transaction lapses
    @Column({ allowNull: true, type: DataType.DATE })                                               expires_at?: Date;

    created_at: Date;

    // ===========================================================================================>> Many to One
    @BelongsTo(() => Order)                                                                         order: Order;
    @BelongsTo(() => User, { foreignKey: 'customer_id',  as: 'customer' })                          customer?: User;
    @BelongsTo(() => User, { foreignKey: 'processed_by', as: 'processor' })                         processor?: User;
}

export default PaymentTransaction;
