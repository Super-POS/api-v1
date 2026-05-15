import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';

/**
 * Adds the `badge` column to `reward_point` if it does not exist yet.
 * Safe to run on every startup (idempotent).
 */
@Injectable()
export class BadgeSchemaPatchService implements OnModuleInit {
    private readonly logger = new Logger(BadgeSchemaPatchService.name);

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
            `ALTER TABLE reward_point ADD COLUMN IF NOT EXISTS badge VARCHAR(200) DEFAULT NULL;`,
            `ALTER TABLE reward_point ADD COLUMN IF NOT EXISTS rank_tier INTEGER NOT NULL DEFAULT 1;`,
            `ALTER TABLE reward_point ADD COLUMN IF NOT EXISTS badge_answers TEXT DEFAULT NULL;`,
        ];
        for (const sql of stmts) {
            try { await this.sequelize.query(sql); } catch (e) {
                this.logger.warn(`badge patch (postgres): ${(e as Error).message}`);
            }
        }
    }

    private async patchMysql(): Promise<void> {
        const cols = [
            { name: 'badge',         ddl: 'VARCHAR(200) DEFAULT NULL' },
            { name: 'rank_tier',     ddl: 'INTEGER NOT NULL DEFAULT 1' },
            { name: 'badge_answers', ddl: 'TEXT DEFAULT NULL' },
        ];
        for (const col of cols) {
            try {
                const [[{ cnt }]] = await this.sequelize.query(`
                    SELECT COUNT(*) AS cnt FROM information_schema.columns
                    WHERE table_name = 'reward_point' AND column_name = '${col.name}';
                `) as any;
                if (Number(cnt) === 0) {
                    await this.sequelize.query(
                        `ALTER TABLE reward_point ADD COLUMN ${col.name} ${col.ddl};`,
                    );
                }
            } catch (e) {
                this.logger.warn(`badge patch (mysql) ${col.name}: ${(e as Error).message}`);
            }
        }
    }
}
