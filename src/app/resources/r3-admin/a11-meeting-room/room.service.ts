import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Op }                  from 'sequelize';
import { BookingStatusEnum }   from '@app/enums/booking-status.enum';
import MeetingRoom             from '@app/models/booking/meeting-room.model';
import MeetingRoomBooking      from '@app/models/booking/meeting-room-booking.model';
import { CreateRoomDto, UpdateRoomDto } from './room.dto';

@Injectable()
export class AdminRoomService {

    async list(): Promise<{ data: MeetingRoom[] }> {
        const data = await MeetingRoom.findAll({ order: [['id', 'ASC']] });
        return { data };
    }

    async create(body: CreateRoomDto): Promise<{ data: MeetingRoom; message: string }> {
        const existing = await MeetingRoom.findOne({ where: { name: body.name } });
        if (existing) throw new BadRequestException('A room with this name already exists.');
        const data = await MeetingRoom.create({ ...body });
        return { data, message: 'Meeting room created.' };
    }

    async findOne(id: number): Promise<{ data: MeetingRoom }> {
        const data = await MeetingRoom.findByPk(id);
        if (!data) throw new NotFoundException('Meeting room not found.');
        return { data };
    }

    async update(id: number, body: UpdateRoomDto): Promise<{ data: MeetingRoom; message: string }> {
        const room = await MeetingRoom.findByPk(id);
        if (!room) throw new NotFoundException('Meeting room not found.');
        if (body.name && body.name !== room.name) {
            const clash = await MeetingRoom.findOne({ where: { name: body.name, id: { [Op.ne]: id } } });
            if (clash) throw new BadRequestException('Another room already uses this name.');
        }
        await room.update({ ...body });
        return { data: room, message: 'Meeting room updated.' };
    }

    async remove(id: number): Promise<{ message: string }> {
        const active = await MeetingRoomBooking.count({
            where: { room_id: id, status: { [Op.in]: [BookingStatusEnum.PENDING, BookingStatusEnum.CONFIRMED] } },
        });
        if (active > 0) throw new BadRequestException('Cannot delete a room with active bookings.');
        const n = await MeetingRoom.destroy({ where: { id } });
        if (n === 0) throw new NotFoundException('Meeting room not found.');
        return { message: 'Meeting room deleted.' };
    }

    async availability(id: number, checkIn: string, checkOut: string): Promise<{ available: boolean; conflicts: MeetingRoomBooking[] }> {
        const room = await MeetingRoom.findByPk(id);
        if (!room) throw new NotFoundException('Meeting room not found.');
        const conflicts = await MeetingRoomBooking.findAll({
            where: {
                room_id : id,
                status  : { [Op.in]: [BookingStatusEnum.PENDING, BookingStatusEnum.CONFIRMED] },
                [Op.and]: [
                    { check_in_date:  { [Op.lte]: checkOut } },
                    { check_out_date: { [Op.gte]: checkIn  } },
                ],
            },
        });
        return { available: conflicts.length === 0, conflicts };
    }
}
