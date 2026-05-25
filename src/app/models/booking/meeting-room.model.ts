import { Column, DataType, HasMany, Model, Table } from 'sequelize-typescript';

import { RoomStatusEnum } from '@app/enums/room-status.enum';
import { RoomTypeEnum }   from '@app/enums/room-type.enum';
import MeetingRoomBooking from './meeting-room-booking.model';

@Table({ tableName: 'meeting_rooms', createdAt: 'created_at', updatedAt: 'updated_at' })
class MeetingRoom extends Model<MeetingRoom> {

    @Column({ primaryKey: true, autoIncrement: true })                                    id: number;

    @Column({ allowNull: false, type: DataType.STRING(100) })                             name: string;
    @Column({ allowNull: true, type: DataType.TEXT })                                     description?: string;
    @Column({ allowNull: false, type: DataType.INTEGER })                                 capacity: number;
    @Column({ allowNull: true, type: DataType.DECIMAL(10, 2) })                           price_per_hour?: number;

    @Column({
        allowNull    : false,
        type         : DataType.ENUM(...Object.values(RoomTypeEnum)),
        defaultValue : RoomTypeEnum.STANDARD,
    })
    type: RoomTypeEnum;

    @Column({
        allowNull    : false,
        type         : DataType.ENUM(...Object.values(RoomStatusEnum)),
        defaultValue : RoomStatusEnum.AVAILABLE,
    })
    status: RoomStatusEnum;

    @Column({ allowNull: true, type: DataType.TEXT })                                     notes?: string;

    created_at: Date;
    updated_at: Date;

    @HasMany(() => MeetingRoomBooking)                                                    bookings: MeetingRoomBooking[];
}

export default MeetingRoom;
