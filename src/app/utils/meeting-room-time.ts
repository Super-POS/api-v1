import { BadRequestException } from '@nestjs/common';

const ON_THE_HOUR = /^([01]\d|2[0-1]):00$/;

/** Meeting rooms are booked in whole-hour blocks (minimum 1 hour). */
export function assertHourlyMeetingTimes(start: string, end: string): void {
    if (!ON_THE_HOUR.test(start) || !ON_THE_HOUR.test(end)) {
        throw new BadRequestException(
            'Meeting times must be on the hour (e.g. 09:00). Bookings use 1-hour blocks only.',
        );
    }

    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const minutes = eh * 60 + em - (sh * 60 + sm);

    if (minutes < 60 || minutes % 60 !== 0) {
        throw new BadRequestException(
            'Minimum booking duration is 1 hour. End time must be a whole number of hours after start.',
        );
    }
}
