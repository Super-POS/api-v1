import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';

/**
 * Adds payment columns for meeting room bookings (Baray intent + status tracking).
 * Safe to run on every startup (idempotent).
 */
@Injectable()
export class MeetingRoomBookingPaymentSchemaPatchService implements OnModuleInit {
    private readonly logger = new Logger(MeetingRoomBookingPaymentSchemaPatchService.name);

    constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

    async onModuleInit(): Promise<void> {
        const dialect = this.sequelize.getDialect();
        if (dialect === 'postgres') {
            await this.patchPostgres();
        } else {
            await this.patchMysql();
        }
    }

    private async tableExists(table: string): Promise<boolean> {
        try {
            if (this.sequelize.getDialect() === 'postgres') {
                const [[row]] = await this.sequelize.query(
                    `SELECT to_regclass('public.${table}') IS NOT NULL AS exists`,
                ) as [{ exists: boolean }[], unknown];
                return Boolean(row?.exists);
            }
            const [[row]] = await this.sequelize.query(
                `SELECT COUNT(*) AS cnt FROM information_schema.tables
                 WHERE table_schema = DATABASE() AND table_name = '${table}'`,
            ) as [{ cnt: number }[], unknown];
            return Number(row?.cnt) > 0;
        } catch {
            return false;
        }
    }

    private async patchPostgres(): Promise<void> {
        if (!(await this.tableExists('meeting_room_bookings'))) {
            return;
        }
        const stmts = [
            `DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_meeting_room_bookings_payment_status') THEN
                    CREATE TYPE enum_meeting_room_bookings_payment_status AS ENUM ('pending','success','failed','expired');
                END IF;
            END $$;`,
            `ALTER TABLE meeting_room_bookings ADD COLUMN IF NOT EXISTS payment_status enum_meeting_room_bookings_payment_status NOT NULL DEFAULT 'pending';`,
            `ALTER TABLE meeting_room_bookings ADD COLUMN IF NOT EXISTS baray_payment_id VARCHAR(120) DEFAULT NULL;`,
            `ALTER TABLE meeting_room_bookings ADD COLUMN IF NOT EXISTS baray_payment_url TEXT DEFAULT NULL;`,
            `ALTER TABLE meeting_room_bookings ADD COLUMN IF NOT EXISTS baray_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;`,
        ];
        for (const sql of stmts) {
            try {
                await this.sequelize.query(sql);
            } catch (e) {
                this.logger.warn(`meeting-room-booking payment patch (postgres): ${(e as Error).message}`);
            }
        }
    }

    private async patchMysql(): Promise<void> {
        if (!(await this.tableExists('meeting_room_bookings'))) {
            return;
        }
        const cols = [
            { name: 'payment_status', ddl: `ENUM('pending','success','failed','expired') NOT NULL DEFAULT 'pending'` },
            { name: 'baray_payment_id', ddl: `VARCHAR(120) DEFAULT NULL` },
            { name: 'baray_payment_url', ddl: `TEXT DEFAULT NULL` },
            { name: 'baray_expires_at', ddl: `DATETIME DEFAULT NULL` },
        ];
        for (const col of cols) {
            try {
                const [[{ cnt }]] = await this.sequelize.query(`
                    SELECT COUNT(*) AS cnt FROM information_schema.columns
                    WHERE table_name = 'meeting_room_bookings' AND column_name = '${col.name}';
                `) as any;
                if (Number(cnt) === 0) {
                    await this.sequelize.query(
                        `ALTER TABLE meeting_room_bookings ADD COLUMN ${col.name} ${col.ddl};`,
                    );
                }
            } catch (e) {
                this.logger.warn(`meeting-room-booking payment patch (mysql) ${col.name}: ${(e as Error).message}`);
            }
        }
    }
}

