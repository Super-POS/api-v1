import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

/** Drops retired KHR denominations (200 R, 200,000 R) from cash drawer tables. */
@Injectable()
export class CashDrawerKhrDenomSchemaPatchService implements OnModuleInit {
    private readonly logger = new Logger(CashDrawerKhrDenomSchemaPatchService.name);

    private readonly retiredColumns = ['khr_200', 'khr_200000'] as const;
    private readonly tables = ['cash_drawer', 'cash_drawer_log'] as const;

    constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

    async onModuleInit(): Promise<void> {
        const dialect = this.sequelize.getDialect();
        for (const table of this.tables) {
            for (const column of this.retiredColumns) {
                try {
                    if (dialect === 'postgres') {
                        await this.sequelize.query(
                            `ALTER TABLE ${table} DROP COLUMN IF EXISTS ${column}`,
                        );
                    } else {
                        await this.dropMysqlColumnIfExists(table, column);
                    }
                } catch (e) {
                    const msg = (e as Error).message || '';
                    if (!msg.includes('does not exist') && !msg.includes("check that column/key exists")) {
                        this.logger.warn(`${table}.${column} drop patch: ${msg}`);
                    }
                }
            }
        }
    }

    private async dropMysqlColumnIfExists(table: string, column: string): Promise<void> {
        const rows = await this.sequelize.query<{ cnt: number }>(
            `
            SELECT COUNT(*) AS cnt
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = :table
              AND COLUMN_NAME = :column
            `,
            { replacements: { table, column }, type: QueryTypes.SELECT },
        );
        if (Number(rows[0]?.cnt ?? 0) > 0) {
            await this.sequelize.query(`ALTER TABLE ${table} DROP COLUMN ${column}`);
        }
    }
}
