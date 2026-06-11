// ===========================================================================>> Third Party Library
import { BelongsTo, Column, CreatedAt, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';

// ===========================================================================>> Custom Library
import User            from '../user/user.model';
import Stamp           from './stamp.model';
import Mission         from './mission.model';

export enum StampSource {
    MISSION      = 'mission',
    DIRECT       = 'direct',
    ADMIN_MANUAL = 'admin_manual',
}

@Table({ tableName: 'customer_stamp', createdAt: 'created_at', updatedAt: false })
export default class CustomerStamp extends Model<CustomerStamp> {

    @Column({ primaryKey: true, autoIncrement: true })
    id: number;

    @ForeignKey(() => User)
    @Column({ allowNull: false, type: DataType.INTEGER })
    customer_id: number;

    @ForeignKey(() => Stamp)
    @Column({ allowNull: false, type: DataType.INTEGER })
    stamp_id: number;

    // Nullable: set when stamp was triggered by a mission completion
    @ForeignKey(() => Mission)
    @Column({ allowNull: true, type: DataType.INTEGER })
    mission_id: number | null;

    @Column({ allowNull: false, type: DataType.ENUM(...Object.values(StampSource)), defaultValue: StampSource.DIRECT })
    source: StampSource;

    @Column({ allowNull: false, type: DataType.DATE, defaultValue: DataType.NOW })
    earned_date: Date;

    @BelongsTo(() => User, { foreignKey: 'customer_id', as: 'customer' })
    customer: User;

    @BelongsTo(() => Stamp, { foreignKey: 'stamp_id', as: 'stamp' })
    stamp: Stamp;

    @BelongsTo(() => Mission, { foreignKey: 'mission_id', as: 'mission' })
    mission: Mission;

    @CreatedAt
    @Column({ type: DataType.DATE })
    created_at: Date;
}
