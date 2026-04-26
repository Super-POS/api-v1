// ================================================================================================= Third Party Library
import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';

// ================================================================================================= Custom Library
import User   from '@app/models/user/user.model';
import Wallet from './wallet.model';

export enum WalletTransactionType {
    DEPOSIT  = 'deposit',
    PAYMENT  = 'payment',
    REFUND   = 'refund',
}

export enum DepositStatus {
    PENDING  = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
}

@Table({ tableName: 'wallet_transaction', createdAt: 'created_at', updatedAt: 'updated_at' })
class WalletTransaction extends Model<WalletTransaction> {

    // ============================================================================================= Primary Key
    @Column({ primaryKey: true, autoIncrement: true })                                              id: number;

    // ============================================================================================= Foreign Key
    @ForeignKey(() => Wallet)
    @Column({ allowNull: false, type: DataType.INTEGER, onDelete: 'CASCADE' })                      wallet_id: number;

    @ForeignKey(() => User)
    @Column({ allowNull: true, type: DataType.INTEGER, onDelete: 'SET NULL' })                      processed_by?: number;

    // ============================================================================================= Field
    @Column({ allowNull: false, type: DataType.ENUM(...Object.values(WalletTransactionType)) })     type: WalletTransactionType;
    @Column({ allowNull: false, type: DataType.DECIMAL(12, 2) })                                    amount: number;

    @Column({
        allowNull    : false,
        type         : DataType.ENUM(...Object.values(DepositStatus)),
        defaultValue : DepositStatus.PENDING,
    })
    status: DepositStatus;

    @Column({ allowNull: true, type: DataType.STRING(100) })                                        reference?: string;
    @Column({ allowNull: true, type: DataType.TEXT })                                               note?: string;

    created_at: Date;

    // ===========================================================================================>> Many to One
    @BelongsTo(() => Wallet)                                                                        wallet: Wallet;
    @BelongsTo(() => User, { foreignKey: 'processed_by', as: 'processor' })                         processor?: User;
}

export default WalletTransaction;
