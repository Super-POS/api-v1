import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Op }                  from 'sequelize';
import { BookingStatusEnum }   from '@app/enums/booking-status.enum';
import { RoomStatusEnum }      from '@app/enums/room-status.enum';
import MeetingRoom             from '@app/models/booking/meeting-room.model';
import MeetingRoomBooking      from '@app/models/booking/meeting-room-booking.model';
import User                    from '@app/models/user/user.model';
import { CreateBookingDto }    from './dto';

@Injectable()
export class CustomerBookingService {

    async list(customerId: number): Promise<{ data: MeetingRoomBooking[] }> {
        const data = await MeetingRoomBooking.findAll({
            where  : { customer_id: customerId },
            order  : [['created_at', 'DESC']],
            include: [{ model: MeetingRoom }],
        });
        return { data };
    }

    async findOne(id: number, customerId: number): Promise<{ data: MeetingRoomBooking }> {
        const data = await MeetingRoomBooking.findOne({
            where  : { id, customer_id: customerId },
            include: [{ model: MeetingRoom }],
        });
        if (!data) throw new NotFoundException('Booking not found.');
        return { data };
    }

    async create(body: CreateBookingDto, customerId: number): Promise<{ data: MeetingRoomBooking; message: string }> {
        const room = await MeetingRoom.findByPk(body.room_id);
        if (!room) throw new NotFoundException('Meeting room not found.');
        if (room.status !== RoomStatusEnum.AVAILABLE) {
            throw new BadRequestException('This room is not available for booking.');
        }

        if (body.check_in_date > body.check_out_date) {
            throw new BadRequestException('check_in_date must be on or before check_out_date.');
        }
        if (body.check_in_date === body.check_out_date && body.meeting_start_time >= body.meeting_end_time) {
            throw new BadRequestException('meeting_start_time must be before meeting_end_time for same-day bookings.');
        }

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
        if (conflict) throw new BadRequestException('The room is already booked for the selected dates.');

        const data = await MeetingRoomBooking.create({
            room_id            : body.room_id,
            customer_id        : customerId,
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
            notes              : body.notes,
            status             : BookingStatusEnum.PENDING,
        });

        await data.reload({ include: [{ model: MeetingRoom }] });
        return { data, message: 'Booking submitted. Please wait for confirmation.' };
    }

    async cancel(id: number, customerId: number): Promise<{ data: MeetingRoomBooking; message: string }> {
        const booking = await MeetingRoomBooking.findOne({ where: { id, customer_id: customerId } });
        if (!booking) throw new NotFoundException('Booking not found.');
        if (booking.status === BookingStatusEnum.CANCELLED) {
            throw new BadRequestException('Booking is already cancelled.');
        }
        if (booking.status === BookingStatusEnum.COMPLETED) {
            throw new ForbiddenException('Completed bookings cannot be cancelled.');
        }
        await booking.update({ status: BookingStatusEnum.CANCELLED });
        return { data: booking, message: 'Booking cancelled.' };
    }
}
