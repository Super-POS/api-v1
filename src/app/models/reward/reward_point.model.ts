// ================================================================================================= Third Party Library
import { BelongsTo, Column, DataType, HasMany, Model, Table } from 'sequelize-typescript';

// ================================================================================================= Custom Library
import User from '@app/models/user/user.model';
import RewardTransaction from './reward_transaction.model';

@Table({ tableName: 'reward_point', createdAt: 'created_at', updatedAt: 'updated_at' })
class RewardPoint extends Model<RewardPoint> {

    // ============================================================================================= Primary Key
    @Column({ primaryKey: true, autoIncrement: true })                                              id: number;

    // ============================================================================================= Foreign Key
    @Column({ allowNull: false, type: DataType.INTEGER, unique: true, onDelete: 'CASCADE' })        customer_id: number;

    // ============================================================================================= Field
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })                          balance: number;

    created_at: Date;

    // ===========================================================================================>> Many to One
    @BelongsTo(() => User, { foreignKey: 'customer_id', as: 'customer' })                           customer: User;

    // ===========================================================================================>> One to Many
    @HasMany(() => RewardTransaction)                                                               transactions: RewardTransaction[];
}

export default RewardPoint;
