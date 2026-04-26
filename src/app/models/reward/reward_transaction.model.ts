// ================================================================================================= Third Party Library
import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';

// ================================================================================================= Custom Library
import User         from '@app/models/user/user.model';
import RewardPoint  from './reward_point.model';

export enum RewardTransactionType {
    EARN   = 'earn',
    REDEEM = 'redeem',
    EXPIRE = 'expire',
}

@Table({ tableName: 'reward_transaction', createdAt: 'created_at', updatedAt: 'updated_at' })
class RewardTransaction extends Model<RewardTransaction> {

    // ============================================================================================= Primary Key
    @Column({ primaryKey: true, autoIncrement: true })                                              id: number;

    // ============================================================================================= Foreign Key
    @ForeignKey(() => RewardPoint)
    @Column({ allowNull: false, type: DataType.INTEGER, onDelete: 'CASCADE' })                      reward_point_id: number;

    @ForeignKey(() => User)
    @Column({ allowNull: false, type: DataType.INTEGER, onDelete: 'CASCADE' })                      customer_id: number;

    // ============================================================================================= Field
    @Column({ allowNull: false, type: DataType.ENUM(...Object.values(RewardTransactionType)) })     type: RewardTransactionType;
    @Column({ allowNull: false, type: DataType.INTEGER })                                           points: number;
    @Column({ allowNull: true, type: DataType.STRING(100) })                                        reference?: string;
    @Column({ allowNull: true, type: DataType.TEXT })                                               note?: string;

    // Points earned expire after a fixed period; only relevant for EARN rows
    @Column({ allowNull: true, type: DataType.DATE })                                               expires_at?: Date;

    created_at: Date;

    // ===========================================================================================>> Many to One
    @BelongsTo(() => RewardPoint)                                                                   reward_point: RewardPoint;
    @BelongsTo(() => User, { foreignKey: 'customer_id', as: 'customer' })                           customer: User;
}

export default RewardTransaction;
