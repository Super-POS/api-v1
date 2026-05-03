import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

@Injectable()
export class CashDrawerLogEnumPatchService implements OnModuleInit {
    private readonly logger = new Logger(CashDrawerLogEnumPatchService.name);

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
                    WHERE c.relname = 'cash_drawer_log'
                      AND pg_catalog.pg_table_is_visible(c.oid)
                      AND a.attname = 'type'
                      AND a.attnum > 0
                      AND NOT a.attisdropped
                      AND t.typtype = 'e'
                    LIMIT 1
                    `,
                    { type: QueryTypes.SELECT },
                );
                const meta = rows[0];
                if (!meta) {
                    return;
                }
                const typeRef = `"${meta.enum_schema}"."${meta.typname}"`;
                for (const value of ['withdraw', 'reset']) {
                    try {
                        await this.sequelize.query(`ALTER TYPE ${typeRef} ADD VALUE '${value}'`);
                    } catch (e) {
                        const msg = (e as Error).message || '';
                        if (!msg.includes('already exists') && !msg.includes('duplicate_object')) {
                            this.logger.debug(`enum ${meta.typname} add '${value}': ${msg}`);
                        }
                    }
                }
            } else {
                await this.sequelize.query(`
                    ALTER TABLE cash_drawer_log
                    MODIFY COLUMN type ENUM('deposit','change','withdraw','reset') NOT NULL
                `);
            }
        } catch (e) {
            const msg = (e as Error).message || '';
            if (!msg.includes('Duplicate') && !msg.includes('check that column/key exists')) {
                this.logger.warn(`cash_drawer_log type enum patch: ${msg}`);
            }
        }
    }
}
