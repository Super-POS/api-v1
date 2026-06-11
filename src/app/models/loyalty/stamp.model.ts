// ===========================================================================>> Third Party Library
import { Column, CreatedAt, DataType, HasMany, Model, Table, UpdatedAt } from 'sequelize-typescript';

export enum StampCategory {
    DRINK      = 'drink',
    EVENT      = 'event',
    COMMUNITY  = 'community',
    MILESTONE  = 'milestone',
    REFERRAL   = 'referral',
}

@Table({ tableName: 'stamp', createdAt: 'created_at', updatedAt: 'updated_at' })
export default class Stamp extends Model<Stamp> {

    @Column({ primaryKey: true, autoIncrement: true })
    id: number;

    @Column({ allowNull: false, type: DataType.STRING(200) })
    name: string;

    @Column({ allowNull: true, type: DataType.TEXT })
    description: string | null;

    @Column({ allowNull: false, type: DataType.ENUM(...Object.values(StampCategory)) })
    category: StampCategory;

    // Human-readable explanation of how to earn this stamp
    @Column({ allowNull: true, type: DataType.STRING(500) })
    trigger_condition: string | null;

    // Bonus Impact Points awarded when stamp is issued
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 0 })
    points_bonus: number;

    @Column({ allowNull: true, type: DataType.STRING(500) })
    icon: string | null;

    @Column({ allowNull: false, type: DataType.BOOLEAN, defaultValue: true })
    is_active: boolean;

    @CreatedAt
    @Column({ type: DataType.DATE })
    created_at: Date;

    @UpdatedAt
    @Column({ type: DataType.DATE })
    updated_at: Date;
}
