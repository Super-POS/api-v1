import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { MeetingRoomSeeder } from 'src/database/seeds/pos/meeting-room.seeder';

/**
 * Creates meeting_rooms + meeting_room_bookings tables when missing.
 * Safe to run on every startup (idempotent).
 */
@Injectable()
export class MeetingRoomSchemaPatchService implements OnModuleInit {
    private readonly logger = new Logger(MeetingRoomSchemaPatchService.name);

    constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

    async onModuleInit(): Promise<void> {
        const dialect = this.sequelize.getDialect();
        if (dialect === 'postgres') {
            await this.patchPostgres();
        } else {
            await this.patchMysql();
        }
    }

    private async patchPostgres(): Promise<void> {
        const stmts = [
            `DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_meeting_rooms_type') THEN
                    CREATE TYPE enum_meeting_rooms_type AS ENUM ('standard','vip','conference','executive');
                END IF;
            END $$;`,
            `DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_meeting_rooms_status') THEN
                    CREATE TYPE enum_meeting_rooms_status AS ENUM ('available','maintenance','inactive');
                END IF;
            END $$;`,
            `DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_meeting_room_bookings_status') THEN
                    CREATE TYPE enum_meeting_room_bookings_status AS ENUM ('pending','confirmed','cancelled','completed');
                END IF;
            END $$;`,
            `DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_meeting_room_bookings_payment_status') THEN
                    CREATE TYPE enum_meeting_room_bookings_payment_status AS ENUM ('pending','success','failed','expired');
                END IF;
            END $$;`,
            `CREATE TABLE IF NOT EXISTS meeting_rooms (
                id              SERIAL PRIMARY KEY,
                name            VARCHAR(100) NOT NULL,
                description     TEXT,
                capacity        INTEGER NOT NULL,
                price_per_hour  DECIMAL(10, 2),
                type            enum_meeting_rooms_type NOT NULL DEFAULT 'standard',
                status          enum_meeting_rooms_status NOT NULL DEFAULT 'available',
                notes           TEXT,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );`,
            `CREATE TABLE IF NOT EXISTS meeting_room_bookings (
                id                       SERIAL PRIMARY KEY,
                room_id                  INTEGER NOT NULL REFERENCES meeting_rooms(id) ON DELETE CASCADE,
                customer_id              INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
                guest_name               VARCHAR(100) NOT NULL,
                guest_phone              VARCHAR(30) NOT NULL,
                guest_email              VARCHAR(150) NOT NULL,
                guest_origin             VARCHAR(100),
                check_in_date            DATE NOT NULL,
                check_out_date           DATE NOT NULL,
                meeting_start_time       VARCHAR(5) NOT NULL,
                meeting_end_time         VARCHAR(5) NOT NULL,
                num_guests               INTEGER NOT NULL DEFAULT 1,
                num_rooms                INTEGER NOT NULL DEFAULT 1,
                purpose                  VARCHAR(255),
                total_amount             DECIMAL(10, 2),
                payment_method           VARCHAR(30) NOT NULL DEFAULT 'baray',
                payment_status           enum_meeting_room_bookings_payment_status NOT NULL DEFAULT 'pending',
                baray_payment_id         VARCHAR(120),
                baray_payment_url        TEXT,
                baray_expires_at         TIMESTAMPTZ,
                status                   enum_meeting_room_bookings_status NOT NULL DEFAULT 'pending',
                notes                    TEXT,
                google_calendar_event_id VARCHAR(255),
                created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );`,
            `CREATE INDEX IF NOT EXISTS meeting_room_bookings_room_id_idx ON meeting_room_bookings(room_id);`,
            `CREATE INDEX IF NOT EXISTS meeting_room_bookings_customer_id_idx ON meeting_room_bookings(customer_id);`,
            `CREATE INDEX IF NOT EXISTS meeting_room_bookings_dates_idx ON meeting_room_bookings(check_in_date, check_out_date);`,
        ];

        for (const sql of stmts) {
            try {
                await this.sequelize.query(sql);
            } catch (e) {
                this.logger.warn(`meeting-room schema patch (postgres): ${(e as Error).message}`);
            }
        }

        try {
            await MeetingRoomSeeder.seedIfEmpty();
        } catch (e) {
            this.logger.warn(`meeting-room seed (postgres): ${(e as Error).message}`);
        }
    }

    private async patchMysql(): Promise<void> {
        try {
            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS meeting_rooms (
                    id              INT AUTO_INCREMENT PRIMARY KEY,
                    name            VARCHAR(100) NOT NULL,
                    description     TEXT,
                    capacity        INT NOT NULL,
                    price_per_hour  DECIMAL(10, 2),
                    type            ENUM('standard','vip','conference','executive') NOT NULL DEFAULT 'standard',
                    status          ENUM('available','maintenance','inactive') NOT NULL DEFAULT 'available',
                    notes           TEXT,
                    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);
            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS meeting_room_bookings (
                    id                       INT AUTO_INCREMENT PRIMARY KEY,
                    room_id                  INT NOT NULL,
                    customer_id              INT NULL,
                    guest_name               VARCHAR(100) NOT NULL,
                    guest_phone              VARCHAR(30) NOT NULL,
                    guest_email              VARCHAR(150) NOT NULL,
                    guest_origin             VARCHAR(100),
                    check_in_date            DATE NOT NULL,
                    check_out_date           DATE NOT NULL,
                    meeting_start_time       VARCHAR(5) NOT NULL,
                    meeting_end_time         VARCHAR(5) NOT NULL,
                    num_guests               INT NOT NULL DEFAULT 1,
                    num_rooms                INT NOT NULL DEFAULT 1,
                    purpose                  VARCHAR(255),
                    total_amount             DECIMAL(10, 2),
                    payment_method           VARCHAR(30) NOT NULL DEFAULT 'baray',
                    payment_status           ENUM('pending','success','failed','expired') NOT NULL DEFAULT 'pending',
                    baray_payment_id         VARCHAR(120),
                    baray_payment_url        TEXT,
                    baray_expires_at         DATETIME,
                    status                   ENUM('pending','confirmed','cancelled','completed') NOT NULL DEFAULT 'pending',
                    notes                    TEXT,
                    google_calendar_event_id VARCHAR(255),
                    created_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (room_id) REFERENCES meeting_rooms(id) ON DELETE CASCADE,
                    FOREIGN KEY (customer_id) REFERENCES user(id) ON DELETE SET NULL
                )
            `);
            try {
                await MeetingRoomSeeder.seedIfEmpty();
            } catch (e) {
                this.logger.warn(`meeting-room seed (mysql): ${(e as Error).message}`);
            }
        } catch (e) {
            this.logger.warn(`meeting-room schema patch (mysql): ${(e as Error).message}`);
        }
    }
}
