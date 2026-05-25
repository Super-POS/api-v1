import { Injectable, Logger } from '@nestjs/common';
import { google }             from 'googleapis';

export interface CalendarEventPayload {
    summary     : string;
    description : string;
    location?   : string;
    startDateTime : string; // ISO 8601, e.g. 2025-06-01T09:00:00+07:00
    endDateTime   : string;
    attendeeEmails?: string[];
}

@Injectable()
export class GoogleCalendarService {

    private readonly logger = new Logger(GoogleCalendarService.name);

    private get calendar() {
        const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
        if (!keyJson) {
            throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_JSON env var is not set.');
        }
        const key = JSON.parse(keyJson);
        const auth = new google.auth.GoogleAuth({
            credentials : key,
            scopes      : ['https://www.googleapis.com/auth/calendar'],
        });
        return google.calendar({ version: 'v3', auth });
    }

    private get calendarId(): string {
        return process.env.GOOGLE_CALENDAR_ID || 'primary';
    }

    async createEvent(payload: CalendarEventPayload): Promise<string | null> {
        try {
            const response = await this.calendar.events.insert({
                calendarId : this.calendarId,
                requestBody: {
                    summary     : payload.summary,
                    description : payload.description,
                    location    : payload.location,
                    start       : { dateTime: payload.startDateTime, timeZone: process.env.DB_TIMEZONE || 'Asia/Phnom_Penh' },
                    end         : { dateTime: payload.endDateTime,   timeZone: process.env.DB_TIMEZONE || 'Asia/Phnom_Penh' },
                    attendees   : payload.attendeeEmails?.map(email => ({ email })),
                },
            });
            return response.data.id ?? null;
        } catch (err) {
            this.logger.error('Failed to create Google Calendar event', err?.message);
            return null;
        }
    }

    async deleteEvent(eventId: string): Promise<void> {
        try {
            await this.calendar.events.delete({ calendarId: this.calendarId, eventId });
        } catch (err) {
            this.logger.warn(`Failed to delete Google Calendar event ${eventId}`, err?.message);
        }
    }

    async updateEvent(eventId: string, payload: Partial<CalendarEventPayload>): Promise<void> {
        try {
            await this.calendar.events.patch({
                calendarId : this.calendarId,
                eventId,
                requestBody: {
                    ...(payload.summary     && { summary: payload.summary }),
                    ...(payload.description && { description: payload.description }),
                    ...(payload.startDateTime && {
                        start: { dateTime: payload.startDateTime, timeZone: process.env.DB_TIMEZONE || 'Asia/Phnom_Penh' },
                    }),
                    ...(payload.endDateTime && {
                        end: { dateTime: payload.endDateTime, timeZone: process.env.DB_TIMEZONE || 'Asia/Phnom_Penh' },
                    }),
                },
            });
        } catch (err) {
            this.logger.warn(`Failed to update Google Calendar event ${eventId}`, err?.message);
        }
    }
}
