import { Injectable, Logger } from '@nestjs/common';
import axios                  from 'axios';
import * as jwt               from 'jsonwebtoken';

export interface CalendarEventPayload {
    summary        : string;
    description    : string;
    location?      : string;
    startDateTime  : string; // ISO 8601 e.g. 2025-06-01T09:00:00
    endDateTime    : string;
    attendeeEmails?: string[];
}

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';
const TOKEN_URL      = 'https://oauth2.googleapis.com/token';
const CALENDAR_BASE  = 'https://www.googleapis.com/calendar/v3';

@Injectable()
export class GoogleCalendarService {

    private readonly logger = new Logger(GoogleCalendarService.name);

    private get _key(): { client_email: string; private_key: string } {
        const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
        if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_JSON is not set.');
        return JSON.parse(raw);
    }

    private get _calendarId(): string {
        return encodeURIComponent(process.env.GOOGLE_CALENDAR_ID || 'primary');
    }

    private get _timezone(): string {
        return process.env.DB_TIMEZONE || 'Asia/Phnom_Penh';
    }

    /** Exchange a signed JWT for a short-lived OAuth2 access token. */
    private async _getAccessToken(): Promise<string> {
        const key = this._key;
        const now = Math.floor(Date.now() / 1000);
        const assertion = jwt.sign(
            { scope: CALENDAR_SCOPE, sub: key.client_email },
            key.private_key,
            {
                algorithm : 'RS256',
                issuer    : key.client_email,
                audience  : TOKEN_URL,
                expiresIn : 3600,
            },
        );
        const res = await axios.post(TOKEN_URL, null, {
            params: { grant_type: 'urn:ietf:params:oauth2:grant-type:jwt-bearer', assertion },
        });
        return res.data.access_token as string;
    }

    async createEvent(payload: CalendarEventPayload): Promise<string | null> {
        try {
            const token = await this._getAccessToken();
            const res   = await axios.post(
                `${CALENDAR_BASE}/calendars/${this._calendarId}/events`,
                {
                    summary     : payload.summary,
                    description : payload.description,
                    location    : payload.location,
                    start       : { dateTime: payload.startDateTime, timeZone: this._timezone },
                    end         : { dateTime: payload.endDateTime,   timeZone: this._timezone },
                    attendees   : payload.attendeeEmails?.map(email => ({ email })),
                },
                { headers: { Authorization: `Bearer ${token}` } },
            );
            return res.data.id ?? null;
        } catch (err) {
            this.logger.error('Failed to create Google Calendar event', err?.message);
            return null;
        }
    }

    async deleteEvent(eventId: string): Promise<void> {
        try {
            const token = await this._getAccessToken();
            await axios.delete(
                `${CALENDAR_BASE}/calendars/${this._calendarId}/events/${eventId}`,
                { headers: { Authorization: `Bearer ${token}` } },
            );
        } catch (err) {
            this.logger.warn(`Failed to delete Google Calendar event ${eventId}`, err?.message);
        }
    }

    async updateEvent(eventId: string, payload: Partial<CalendarEventPayload>): Promise<void> {
        try {
            const token = await this._getAccessToken();
            await axios.patch(
                `${CALENDAR_BASE}/calendars/${this._calendarId}/events/${eventId}`,
                {
                    ...(payload.summary     && { summary: payload.summary }),
                    ...(payload.description && { description: payload.description }),
                    ...(payload.startDateTime && { start: { dateTime: payload.startDateTime, timeZone: this._timezone } }),
                    ...(payload.endDateTime   && { end:   { dateTime: payload.endDateTime,   timeZone: this._timezone } }),
                },
                { headers: { Authorization: `Bearer ${token}` } },
            );
        } catch (err) {
            this.logger.warn(`Failed to update Google Calendar event ${eventId}`, err?.message);
        }
    }
}
