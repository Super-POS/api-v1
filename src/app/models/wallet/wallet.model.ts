// ================================================================================================= Third Party Library
import { BelongsTo, Column, DataType, HasMany, Model, Table } from 'sequelize-typescript';

// ================================================================================================= Custom Library
import User from '@app/models/user/user.model';
import WalletTransaction from './wallet_transaction.model';

@Table({ tableName: 'wallet', createdAt: 'created_at', updatedAt: 'updated_at' })
class Wallet extends Model<Wallet> {

    // ============================================================================================= Primary Key
    @Column({ primaryKey: true, autoIncrement: true })                                              id: number;

    // ============================================================================================= Foreign Key
    @Column({ allowNull: false, type: DataType.INTEGER, unique: true, onDelete: 'CASCADE' })        customer_id: number;

    // ============================================================================================= Field
    @Column({ allowNull: false, type: DataType.DECIMAL(12, 2), defaultValue: 0 })                   balance: number;

    created_at: Date;

    // ===========================================================================================>> Many to One
    @BelongsTo(() => User, { foreignKey: 'customer_id', as: 'customer' })                           customer: User;

    // ===========================================================================================>> One to Many
    @HasMany(() => WalletTransaction)                                                               transactions: WalletTransaction[];
}

export default Wallet;
