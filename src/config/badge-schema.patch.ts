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
        try {
            await this.sequelize.query(`
                ALTER TABLE reward_point
                ADD COLUMN IF NOT EXISTS badge VARCHAR(200) DEFAULT NULL;
            `);
        } catch (e) {
            this.logger.warn(`reward_point.badge patch (postgres): ${(e as Error).message}`);
        }
    }

    private async patchMysql(): Promise<void> {
        try {
            const [[{ cnt }]] = await this.sequelize.query(`
                SELECT COUNT(*) AS cnt
                FROM information_schema.columns
                WHERE table_name = 'reward_point' AND column_name = 'badge';
            `) as any;
            if (Number(cnt) === 0) {
                await this.sequelize.query(`
                    ALTER TABLE reward_point ADD COLUMN badge VARCHAR(200) DEFAULT NULL;
                `);
            }
        } catch (e) {
            this.logger.warn(`reward_point.badge patch (mysql): ${(e as Error).message}`);
        }
    }
}
