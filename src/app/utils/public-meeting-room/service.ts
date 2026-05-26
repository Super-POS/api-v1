import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Op }         from 'sequelize';
import { BookingStatusEnum } from '@app/enums/booking-status.enum';
import { RoomStatusEnum }    from '@app/enums/room-status.enum';
import MeetingRoom           from '@app/models/booking/meeting-room.model';
import MeetingRoomBooking    from '@app/models/booking/meeting-room-booking.model';
import { assertHourlyMeetingTimes } from '@app/utils/meeting-room-time';
import { CreatePublicBookingDto } from './dto';
import { PaymentStatus } from '@app/models/payment/payment_transaction.model';

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

    /**
     * Public booking (no login). Creates a PENDING booking row owned by nobody (customer_id=null).
     * We still validate room availability + overlap rules to prevent overbooking.
     */
    async createPublicBooking(body: CreatePublicBookingDto): Promise<{ data: MeetingRoomBooking; message: string }> {
        const room = await MeetingRoom.findByPk(body.room_id);
        if (!room) {
            throw new NotFoundException('Meeting room not found.');
        }
        if (room.status !== RoomStatusEnum.AVAILABLE) {
            throw new BadRequestException('This room is not available for booking.');
        }

        if (body.check_in_date > body.check_out_date) {
            throw new BadRequestException('check_in_date must be on or before check_out_date.');
        }
        if (body.check_in_date === body.check_out_date && body.meeting_start_time >= body.meeting_end_time) {
            throw new BadRequestException('meeting_start_time must be before meeting_end_time for same-day bookings.');
        }
        assertHourlyMeetingTimes(body.meeting_start_time, body.meeting_end_time);

        const conflict = await MeetingRoomBooking.findOne({
            where: {
                room_id : body.room_id,
                status  : { [Op.in]: [BookingStatusEnum.PENDING, BookingStatusEnum.CONFIRMED] },
                [Op.and]: [
                    { check_in_date:  { [Op.lte]: body.check_out_date } },
                    { check_out_date: { [Op.gte]: body.check_in_date  } },
                ],
            },
        });
        if (conflict) {
            throw new BadRequestException('The room is already booked for the selected dates.');
        }

        const data = await MeetingRoomBooking.create({
            room_id            : body.room_id,
            customer_id        : null,
            guest_name         : body.guest_name,
            guest_phone        : body.guest_phone,
            guest_email        : body.guest_email,
            guest_origin       : body.guest_origin,
            check_in_date      : body.check_in_date,
            check_out_date     : body.check_out_date,
            meeting_start_time : body.meeting_start_time,
            meeting_end_time   : body.meeting_end_time,
            num_guests         : body.num_guests,
            num_rooms          : body.num_rooms,
            purpose            : body.purpose,
            payment_method     : body.payment_method ?? 'baray',
            payment_status     : PaymentStatus.PENDING,
            notes              : body.notes,
            status             : BookingStatusEnum.PENDING,
        });

        await data.reload({ include: [{ model: MeetingRoom }] });
        return { data, message: 'Booking submitted. Please proceed to payment.' };
    }
}
