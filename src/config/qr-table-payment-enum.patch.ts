import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

/**
 * Adds 'qr_table' to the payment_transaction.method ENUM so cashiers can record
 * manual QR payments (customer scans bank QR on the table) without a gateway.
 * Safe to run on every startup (idempotent).
 */
@Injectable()
export class QrTablePaymentEnumPatchService implements OnModuleInit {
    private readonly logger = new Logger(QrTablePaymentEnumPatchService.name);

    constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

    async onModuleInit(): Promise<void> {
        const dialect = this.sequelize.getDialect();
        try {
            if (dialect === 'postgres') {
                const rows = await this.sequelize.query<{ enum_schema: string; typname: string }>(
                    `
                    SELECT tn.nspname AS enum_schema, t.typname AS typname
                    FROM pg_catalog.pg_attribute a
                    INNER JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
                    INNER JOIN pg_catalog.pg_type t ON a.atttypid = t.oid
                    INNER JOIN pg_catalog.pg_namespace tn ON t.typnamespace = tn.oid
                    WHERE c.relname = 'payment_transaction'
                      AND pg_catalog.pg_table_is_visible(c.oid)
                      AND a.attname = 'method'
                      AND a.attnum > 0
                      AND NOT a.attisdropped
                      AND t.typtype = 'e'
                    LIMIT 1
                    `,
                    { type: QueryTypes.SELECT },
                );
                const meta = rows[0];
                if (!meta) return;
                const typeRef = `"${meta.enum_schema}"."${meta.typname}"`;
                try {
                    await this.sequelize.query(`ALTER TYPE ${typeRef} ADD VALUE 'qr_table'`);
                } catch (e) {
                    const msg = (e as Error).message || '';
                    if (!msg.includes('already exists') && !msg.includes('duplicate_object')) {
                        this.logger.debug(`enum ${meta.typname} add 'qr_table': ${msg}`);
                    }
                }
            } else {
                await this.sequelize.query(`
                    ALTER TABLE payment_transaction
                    MODIFY COLUMN method ENUM('cash','wallet','card','qr','qr_table') NOT NULL
                `);
            }
        } catch (e) {
            const msg = (e as Error).message || '';
            if (!msg.includes('Duplicate') && !msg.includes('check that column/key exists')) {
                this.logger.warn(`payment_transaction method enum patch: ${msg}`);
            }
        }
    }
}
