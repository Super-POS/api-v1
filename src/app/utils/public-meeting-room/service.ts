import { Injectable } from '@nestjs/common';
import { Op }         from 'sequelize';
import { BookingStatusEnum } from '@app/enums/booking-status.enum';
import { RoomStatusEnum }    from '@app/enums/room-status.enum';
import MeetingRoom           from '@app/models/booking/meeting-room.model';
import MeetingRoomBooking    from '@app/models/booking/meeting-room-booking.model';

@Injectable()
export class PublicMeetingRoomService {

    async listAvailable(): Promise<{ data: MeetingRoom[] }> {
        const data = await MeetingRoom.findAll({
            where: { status: RoomStatusEnum.AVAILABLE },
            order: [['id', 'ASC']],
        });
        return { data };
    }

    /** Returns all rooms (available only) annotated with whether they are free for the given date range. */
    async checkAvailability(checkIn: string, checkOut: string): Promise<{ data: Array<MeetingRoom & { is_available: boolean }> }> {
        const rooms = await MeetingRoom.findAll({
            where: { status: RoomStatusEnum.AVAILABLE },
            order: [['id', 'ASC']],
        });

        const bookedRoomIds = new Set<number>();
        if (checkIn && checkOut) {
            const bookings = await MeetingRoomBooking.findAll({
                attributes: ['room_id'],
                where: {
                    status  : { [Op.in]: [BookingStatusEnum.PENDING, BookingStatusEnum.CONFIRMED] },
                    [Op.and]: [
                        { check_in_date:  { [Op.lte]: checkOut } },
                        { check_out_date: { [Op.gte]: checkIn  } },
                    ],
                },
            });
            bookings.forEach(b => bookedRoomIds.add(b.room_id));
        }

        const data = rooms.map(room => {
            const plain = room.toJSON() as MeetingRoom & { is_available: boolean };
            plain.is_available = !bookedRoomIds.has(room.id);
            return plain;
        });

        return { data };
    }
}
