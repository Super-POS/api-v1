import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';

import { BookingStatusEnum } from '@app/enums/booking-status.enum';
import MeetingRoom           from './meeting-room.model';
import User                  from '@app/models/user/user.model';
import { PaymentStatus } from '@app/models/payment/payment_transaction.model';

@Table({ tableName: 'meeting_room_bookings', createdAt: 'created_at', updatedAt: 'updated_at' })
class MeetingRoomBooking extends Model<MeetingRoomBooking> {

    @Column({ primaryKey: true, autoIncrement: true })                                    id: number;

    // ========================================================================================= Foreign Keys
    @ForeignKey(() => MeetingRoom) @Column({ allowNull: false, onDelete: 'CASCADE' })     room_id: number;
    @ForeignKey(() => User)        @Column({ allowNull: true,  onDelete: 'SET NULL' })    customer_id?: number;

    // ========================================================================================= Guest Information
    @Column({ allowNull: false, type: DataType.STRING(100) })                             guest_name: string;
    @Column({ allowNull: false, type: DataType.STRING(30) })                              guest_phone: string;
    @Column({ allowNull: false, type: DataType.STRING(150) })                             guest_email: string;
    @Column({ allowNull: true,  type: DataType.STRING(100) })                             guest_origin?: string;

    // ========================================================================================= Booking Details
    @Column({ allowNull: false, type: DataType.DATEONLY })                                check_in_date: string;
    @Column({ allowNull: false, type: DataType.DATEONLY })                                check_out_date: string;
    @Column({ allowNull: false, type: DataType.STRING(5) })                               meeting_start_time: string; // HH:MM
    @Column({ allowNull: false, type: DataType.STRING(5) })                               meeting_end_time: string;   // HH:MM
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 1 })                num_guests: number;
    @Column({ allowNull: false, type: DataType.INTEGER, defaultValue: 1 })                num_rooms: number;
    @Column({ allowNull: true,  type: DataType.STRING(255) })                             purpose?: string;

    // ========================================================================================= Payment
    @Column({ allowNull: true,  type: DataType.DECIMAL(10, 2) })                          total_amount?: number;
    @Column({ allowNull: false, type: DataType.STRING(30), defaultValue: 'baray' })       payment_method: string;
    @Column({
        allowNull: false,
        type: DataType.ENUM(...Object.values(PaymentStatus)),
        defaultValue: PaymentStatus.PENDING,
    })
    payment_status: PaymentStatus;

    /** Baray pay link id (Baray `_id` / `id`) for pending and settled payments. */
    @Column({ allowNull: true, type: DataType.STRING(120) })                              baray_payment_id?: string;
    /** Full checkout URL for Baray (open externally). */
    @Column({ allowNull: true, type: DataType.TEXT })                                     baray_payment_url?: string;
    /** When the Baray pay link is no longer valid. */
    @Column({ allowNull: true, type: DataType.DATE })                                     baray_expires_at?: Date;

    // ========================================================================================= Status & Notes
    @Column({
        allowNull    : false,
        type         : DataType.ENUM(...Object.values(BookingStatusEnum)),
        defaultValue : BookingStatusEnum.PENDING,
    })
    status: BookingStatusEnum;

    @Column({ allowNull: true, type: DataType.TEXT })                                     notes?: string;

    // ========================================================================================= Google Calendar
    @Column({ allowNull: true, type: DataType.STRING(255) })                              google_calendar_event_id?: string;

    created_at: Date;
    updated_at: Date;

    // ========================================================================================= Relations
    @BelongsTo(() => MeetingRoom, { foreignKey: 'room_id' })                             room: MeetingRoom;
    @BelongsTo(() => User,        { foreignKey: 'customer_id', as: 'customer' })         customer?: User;
}

export default MeetingRoomBooking;
