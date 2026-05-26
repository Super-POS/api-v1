import { Op } from 'sequelize';
import MeetingRoom from '@app/models/booking/meeting-room.model';
import MeetingRoomBooking from '@app/models/booking/meeting-room-booking.model';
import { RoomStatusEnum } from '@app/enums/room-status.enum';
import { RoomTypeEnum } from '@app/enums/room-type.enum';

/** Club 54 — professional meeting-room catalogue (upserted by name). */
export const CLUB54_MEETING_ROOMS: Array<{
    name: string;
    description: string;
    capacity: number;
    price_per_hour: number;
    type: RoomTypeEnum;
    status: RoomStatusEnum;
    notes?: string;
}> = [
    {
        name: 'The Boardroom',
        description:
            'Executive boardroom with 75" 4K display, HDMI & USB-C, Zoom-ready camera, and acoustic wall panels. Ideal for leadership reviews and client pitches.',
        capacity: 8,
        price_per_hour: 48,
        type: RoomTypeEnum.EXECUTIVE,
        status: RoomStatusEnum.AVAILABLE,
        notes: 'Level 2 · HDMI + USB-C · Video conferencing',
    },
    {
        name: 'Summit Hall',
        description:
            'Flagship conference space seating up to 24. Dual projectors, wireless presentation, conference phone, and a small catering prep counter.',
        capacity: 24,
        price_per_hour: 62,
        type: RoomTypeEnum.CONFERENCE,
        status: RoomStatusEnum.AVAILABLE,
        notes: 'Level 2 · Dual projectors · Catering prep',
    },
    {
        name: 'Innovation Lab',
        description:
            'Workshop-ready room with movable tables, wall-mounted screen, and marker-friendly walls. Built for design sprints, training, and team offsites.',
        capacity: 16,
        price_per_hour: 52,
        type: RoomTypeEnum.CONFERENCE,
        status: RoomStatusEnum.AVAILABLE,
        notes: 'Level 1 · Flexible furniture · Whiteboard walls',
    },
    {
        name: 'Creators Lounge',
        description:
            'VIP lounge layout with sofa corner, whiteboard wall, and ring light setup. Perfect for content planning, influencer briefings, and creative workshops.',
        capacity: 10,
        price_per_hour: 36,
        type: RoomTypeEnum.VIP,
        status: RoomStatusEnum.AVAILABLE,
        notes: 'Level 1 · Lounge seating · Content-friendly lighting',
    },
    {
        name: 'Riverside Retreat',
        description:
            'Daylight-facing meeting room with lounge seating and a calm atmosphere. Suited for executive sessions, investor meetings, and confidential discussions.',
        capacity: 6,
        price_per_hour: 42,
        type: RoomTypeEnum.VIP,
        status: RoomStatusEnum.AVAILABLE,
        notes: 'Level 2 · Natural light · Lounge layout',
    },
    {
        name: 'Training Theater',
        description:
            'Theater-style seating for up to 32 guests, presenter stage, wireless clicker, PA microphone, and coat rack. Best for seminars and all-hands.',
        capacity: 32,
        price_per_hour: 72,
        type: RoomTypeEnum.CONFERENCE,
        status: RoomStatusEnum.AVAILABLE,
        notes: 'Ground floor · Theater seating · PA system',
    },
    {
        name: 'Huddle Nook',
        description:
            'Compact space for stand-ups, sprint planning, and quick team syncs. Optional standing-height table on request.',
        capacity: 6,
        price_per_hour: 20,
        type: RoomTypeEnum.STANDARD,
        status: RoomStatusEnum.AVAILABLE,
        notes: 'Level 1 · Quick bookings · Stand-up friendly',
    },
    {
        name: 'Focus Studio',
        description:
            'Quiet pod for interviews, 1:1s, and deep work. Includes 27" monitor and USB-C dock; minimal distractions.',
        capacity: 4,
        price_per_hour: 16,
        type: RoomTypeEnum.STANDARD,
        status: RoomStatusEnum.AVAILABLE,
        notes: 'Level 1 · Monitor + dock · Low noise',
    },
    {
        name: 'Podcast Booth',
        description:
            'Sound-treated two-person booth with desk mic arms and acoustic foam. Currently offline while we upgrade recording equipment.',
        capacity: 2,
        price_per_hour: 14,
        type: RoomTypeEnum.STANDARD,
        status: RoomStatusEnum.MAINTENANCE,
        notes: 'Level 1 · Audio booth · Temporarily unavailable',
    },
];

/** Legacy placeholder rows from early bootstrap seed — safe to remove when empty. */
const LEGACY_PLACEHOLDER_NAMES = ['Conference Room A', 'Executive Suite'];

export type MeetingRoomSeedOptions = {
    /** Update description, pricing, and status for rooms already in the catalogue. */
    refresh?: boolean;
    /** Remove legacy placeholder rooms that have no bookings. */
    removeLegacyPlaceholders?: boolean;
};

export class MeetingRoomSeeder {
    public static async seed(options: MeetingRoomSeedOptions = {}): Promise<void> {
        const { refresh = false, removeLegacyPlaceholders = false } = options;

        for (const row of CLUB54_MEETING_ROOMS) {
            const [room, created] = await MeetingRoom.findOrCreate({
                where: { name: row.name },
                defaults: row,
            });
            if (!created && refresh) {
                await room.update(row);
            }
        }

        if (removeLegacyPlaceholders) {
            await MeetingRoomSeeder.removeLegacyPlaceholders();
        }
    }

    /** Seed only when the table has no rows (first install). */
    public static async seedIfEmpty(): Promise<void> {
        const count = await MeetingRoom.count();
        if (count === 0) {
            await MeetingRoomSeeder.seed();
        }
    }

    private static async removeLegacyPlaceholders(): Promise<void> {
        const legacy = await MeetingRoom.findAll({
            where: { name: { [Op.in]: LEGACY_PLACEHOLDER_NAMES } },
        });
        for (const room of legacy) {
            const bookings = await MeetingRoomBooking.count({ where: { room_id: room.id } });
            if (bookings === 0) {
                await room.destroy();
            }
        }
    }
}
