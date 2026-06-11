// ===========================================================================>> Third Party Library
import { BelongsTo, Column, CreatedAt, DataType, ForeignKey, HasMany, Model, Table, UpdatedAt } from 'sequelize-typescript';

// ===========================================================================>> Custom Library
import Stamp from './stamp.model';

export enum MissionRequirementType {
    PURCHASE       = 'purchase',
    REFERRAL       = 'referral',
    EVENT_CHECKIN  = 'event_checkin',
    VISIT          = 'visit',
    PROFILE_ACTION = 'profile_action',
}

export enum MissionStatus {
    ACTIVE   = 'active',
    INACTIVE = 'inactive',
    DRAFT    = 'draft',
}

@Table({ tableName: 'mission', createdAt: 'created_at', updatedAt: 'updated_at' })
export default class Mission extends Model<Mission> {

    @Column({ primaryKey: true, autoIncrement: true })
    id: number;

    @Column({ allowNull: false, type: DataType.STRING(200) })
    name: string;

    @Column({ allowNull: true, type: DataType.TEXT })
    description: string | null;

    @Column({ allowNull: false, type: DataType.ENUM(...Object.values(MissionRequirementType)) })
    requirement_type: MissionRequirementType;

    // How many times the requirement must be met (e.g. buy 3 drinks → target_value = 3)
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 1 })
    target_value: number;

    // Bonus Impact Points awarded on mission completion
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })
    reward_points: number;

    // Optional: stamp issued when mission is completed
    @ForeignKey(() => Stamp)
    @Column({ allowNull: true, type: DataType.INTEGER })
    reward_stamp_id: number | null;

    @Column({ allowNull: false, type: DataType.ENUM(...Object.values(MissionStatus)), defaultValue: MissionStatus.DRAFT })
    status: MissionStatus;

    @Column({ allowNull: true, type: DataType.DATE })
    start_date: Date | null;

    @Column({ allowNull: true, type: DataType.DATE })
    end_date: Date | null;

    // How many times one customer can complete this mission (null = unlimited)
    @Column({ allowNull: true, type: DataType.INTEGER })
    max_completions_per_user: number | null;

    @Column({ allowNull: true, type: DataType.STRING(500) })
    icon: string | null;

    @BelongsTo(() => Stamp, { foreignKey: 'reward_stamp_id', as: 'reward_stamp' })
    reward_stamp: Stamp;

    @CreatedAt
    @Column({ type: DataType.DATE })
    created_at: Date;

    @UpdatedAt
    @Column({ type: DataType.DATE })
    updated_at: Date;
}
