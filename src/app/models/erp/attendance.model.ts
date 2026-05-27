import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import ErpEmployee from './employee.model';

export enum AttendanceStatus {
    PRESENT   = 'present',
    ABSENT    = 'absent',
    LATE      = 'late',
    HALF_DAY  = 'half_day',
    HOLIDAY   = 'holiday',
    ON_LEAVE  = 'on_leave',
}

@Table({ tableName: 'erp_attendance', createdAt: 'created_at', updatedAt: 'updated_at' })
class ErpAttendance extends Model<ErpAttendance> {

    @Column({ primaryKey: true, autoIncrement: true })
    id: number;

    @ForeignKey(() => ErpEmployee)
    @Column({ allowNull: false, type: DataType.INTEGER, onDelete: 'CASCADE' })
    employee_id: number;

    @Column({ allowNull: false, type: DataType.DATEONLY })
    date: string;

    @Column({ allowNull: true, type: DataType.TIME })
    clock_in?: string;

    @Column({ allowNull: true, type: DataType.TIME })
    clock_out?: string;

    /** Computed hours worked = clock_out - clock_in */
    @Column({ allowNull: false, type: DataType.DECIMAL(5, 2), defaultValue: 0 })
    hours_worked: number;

    /** Overtime hours beyond standard shift (e.g. > 8h) */
    @Column({ allowNull: false, type: DataType.DECIMAL(5, 2), defaultValue: 0 })
    overtime_hours: number;

    @Column({
        allowNull: false,
        type: DataType.ENUM(...Object.values(AttendanceStatus)),
        defaultValue: AttendanceStatus.PRESENT,
    })
    status: AttendanceStatus;

    @Column({ allowNull: true, type: DataType.TEXT })
    notes?: string;

    created_at: Date;

    @BelongsTo(() => ErpEmployee)
    employee: ErpEmployee;
}

export default ErpAttendance;
