import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Op }                      from 'sequelize';
import { BookingStatusEnum }       from '@app/enums/booking-status.enum';
import MeetingRoom                 from '@app/models/booking/meeting-room.model';
import MeetingRoomBooking          from '@app/models/booking/meeting-room-booking.model';
import User                        from '@app/models/user/user.model';
import { GoogleCalendarService }   from '@app/services/google-calendar.service';
import { PaymentStatus }           from '@app/models/payment/payment_transaction.model';

const ALLOWED_TRANSITIONS: Record<BookingStatusEnum, BookingStatusEnum[]> = {
    [BookingStatusEnum.PENDING]   : [BookingStatusEnum.CONFIRMED, BookingStatusEnum.CANCELLED],
    [BookingStatusEnum.CONFIRMED] : [BookingStatusEnum.COMPLETED, BookingStatusEnum.CANCELLED],
    [BookingStatusEnum.CANCELLED] : [],
    [BookingStatusEnum.COMPLETED] : [],
};

@Injectable()
export class AdminBookingService {
    constructor(private readonly _calendar: GoogleCalendarService) {}

    async list(status?: BookingStatusEnum): Promise<{ data: MeetingRoomBooking[] }> {
        const where: Record<string, unknown> = {};
        if (status) where['status'] = status;
        const data = await MeetingRoomBooking.findAll({
            where,
            order  : [['created_at', 'DESC']],
            include: [
                { model: MeetingRoom },
                { model: User, as: 'customer', attributes: ['id', 'name', 'phone', 'email'] },
            ],
        });
        return { data };
    }

    async findOne(id: number): Promise<{ data: MeetingRoomBooking }> {
        const data = await MeetingRoomBooking.findByPk(id, {
            include: [
                { model: MeetingRoom },
                { model: User, as: 'customer', attributes: ['id', 'name', 'phone', 'email'] },
            ],
        });
        if (!data) throw new NotFoundException('Booking not found.');
        return { data };
    }

    async updateStatus(id: number, newStatus: BookingStatusEnum): Promise<{ data: MeetingRoomBooking; message: string }> {
        const booking = await MeetingRoomBooking.findByPk(id, { include: [{ model: MeetingRoom }] });
        if (!booking) throw new NotFoundException('Booking not found.');

        const allowed = ALLOWED_TRANSITIONS[booking.status];
        if (!allowed.includes(newStatus)) {
            throw new BadRequestException(
                `Cannot transition from '${booking.status}' to '${newStatus}'.`,
            );
        }

        if (newStatus === BookingStatusEnum.COMPLETED) {
            if (String(booking.payment_status).toLowerCase() !== PaymentStatus.SUCCESS) {
                throw new BadRequestException(
                    'Booking must be paid before it can be marked completed.',
                );
            }
        }

        // Check for conflicts when confirming
        if (newStatus === BookingStatusEnum.CONFIRMED) {
            const conflict = await MeetingRoomBooking.findOne({
                where: {
                    room_id : booking.room_id,
                    status  : BookingStatusEnum.CONFIRMED,
                    id      : { [Op.ne]: id },
                    [Op.and]: [
                        { check_in_date:  { [Op.lte]: booking.check_out_date } },
                        { check_out_date: { [Op.gte]: booking.check_in_date  } },
                    ],
                },
            });
            if (conflict) throw new BadRequestException('Another confirmed booking overlaps these dates.');
        }

        await booking.update({ status: newStatus });

        // Sync Google Calendar
        if (newStatus === BookingStatusEnum.CONFIRMED) {
            const eventId = await this._calendar.createEvent({
                summary    : `Meeting Room: ${booking.room?.name ?? 'Room'} — ${booking.guest_name}`,
                description: [
                    `Guest: ${booking.guest_name}`,
                    `Phone: ${booking.guest_phone}`,
                    `Email: ${booking.guest_email}`,
                    booking.guest_origin ? `From: ${booking.guest_origin}` : '',
                    `Guests: ${booking.num_guests}  |  Rooms: ${booking.num_rooms}`,
                    booking.purpose ? `Purpose: ${booking.purpose}` : '',
                    booking.notes   ? `Notes: ${booking.notes}`     : '',
                ].filter(Boolean).join('\n'),
                startDateTime  : `${booking.check_in_date}T${booking.meeting_start_time}:00`,
                endDateTime    : `${booking.check_out_date}T${booking.meeting_end_time}:00`,
                attendeeEmails : [booking.guest_email],
            });
            if (eventId) await booking.update({ google_calendar_event_id: eventId });
        }

        if (newStatus === BookingStatusEnum.CANCELLED && booking.google_calendar_event_id) {
            await this._calendar.deleteEvent(booking.google_calendar_event_id);
            await booking.update({ google_calendar_event_id: null });
        }

        await booking.reload({ include: [{ model: MeetingRoom }, { model: User, as: 'customer', attributes: ['id', 'name', 'phone', 'email'] }] });
        return { data: booking, message: `Booking ${newStatus}.` };
    }

    /** Record in-person / cash payment so the booking can be completed later. */
    async markPaid(id: number): Promise<{ data: MeetingRoomBooking; message: string }> {
        const booking = await MeetingRoomBooking.findByPk(id, {
            include: [
                { model: MeetingRoom },
                { model: User, as: 'customer', attributes: ['id', 'name', 'phone', 'email'] },
            ],
        });
        if (!booking) throw new NotFoundException('Booking not found.');

        const status = booking.status;
        if (status === BookingStatusEnum.CANCELLED || status === BookingStatusEnum.COMPLETED) {
            throw new BadRequestException('Cannot record payment for a closed booking.');
        }
        if (String(booking.payment_status).toLowerCase() === PaymentStatus.SUCCESS) {
            throw new BadRequestException('This booking is already paid.');
        }

        const method = (booking.payment_method ?? 'cash').toLowerCase() === 'baray'
            ? 'cash'
            : (booking.payment_method ?? 'cash');

        await booking.update({
            payment_status: PaymentStatus.SUCCESS,
            payment_method: method,
        });

        await booking.reload({
            include: [
                { model: MeetingRoom },
                { model: User, as: 'customer', attributes: ['id', 'name', 'phone', 'email'] },
            ],
        });
        return { data: booking, message: 'Payment recorded.' };
    }
}
