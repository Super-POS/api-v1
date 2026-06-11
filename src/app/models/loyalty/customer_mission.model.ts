// ===========================================================================>> Third Party Library
import { BelongsTo, Column, CreatedAt, DataType, ForeignKey, Model, Table, UpdatedAt } from 'sequelize-typescript';

// ===========================================================================>> Custom Library
import User    from '../user/user.model';
import Mission from './mission.model';

export enum CustomerMissionStatus {
    IN_PROGRESS = 'in_progress',
    COMPLETED   = 'completed',
    EXPIRED     = 'expired',
}

@Table({ tableName: 'customer_mission', createdAt: 'created_at', updatedAt: 'updated_at' })
export default class CustomerMission extends Model<CustomerMission> {

    @Column({ primaryKey: true, autoIncrement: true })
    id: number;

    @ForeignKey(() => User)
    @Column({ allowNull: false, type: DataType.INTEGER })
    customer_id: number;

    @ForeignKey(() => Mission)
    @Column({ allowNull: false, type: DataType.INTEGER })
    mission_id: number;

    // How many qualifying actions the customer has done toward target_value
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })
    progress: number;

    @Column({ allowNull: false, type: DataType.ENUM(...Object.values(CustomerMissionStatus)), defaultValue: CustomerMissionStatus.IN_PROGRESS })
    status: CustomerMissionStatus;

    @Column({ allowNull: true, type: DataType.DATE })
    completed_at: Date | null;

    @BelongsTo(() => User, { foreignKey: 'customer_id', as: 'customer' })
    customer: User;

    @BelongsTo(() => Mission, { foreignKey: 'mission_id', as: 'mission' })
    mission: Mission;

    @CreatedAt
    @Column({ type: DataType.DATE })
    created_at: Date;

    @UpdatedAt
    @Column({ type: DataType.DATE })
    updated_at: Date;
}
