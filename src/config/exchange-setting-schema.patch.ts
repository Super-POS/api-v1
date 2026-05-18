import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';

@Injectable()
export class ExchangeSettingSchemaPatchService implements OnModuleInit {
    private readonly logger = new Logger(ExchangeSettingSchemaPatchService.name);

    constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

    async onModuleInit(): Promise<void> {
        const dialect = this.sequelize.getDialect();
        if (dialect !== 'postgres') {
            return;
        }
        try {
            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS pos_exchange_setting (
                    id SMALLINT PRIMARY KEY DEFAULT 1,
                    khr_per_usd DECIMAL(14, 4) NOT NULL DEFAULT 4100,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `);
            await this.sequelize.query(`
                ALTER TABLE pos_exchange_setting
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ
            `);
            await this.sequelize.query(`
                UPDATE pos_exchange_setting
                SET updated_at = NOW()
                WHERE updated_at IS NULL
            `);
            await this.sequelize.query(`
                ALTER TABLE pos_exchange_setting
                ALTER COLUMN updated_at SET DEFAULT NOW()
            `);
            await this.sequelize.query(`
                ALTER TABLE pos_exchange_setting
                ALTER COLUMN updated_at SET NOT NULL
            `);
            await this.sequelize.query(`
                INSERT INTO pos_exchange_setting (id, khr_per_usd, updated_at)
                VALUES (1, 4100, NOW())
                ON CONFLICT (id) DO NOTHING
            `);
        } catch (e) {
            this.logger.warn(`pos_exchange_setting patch: ${(e as Error).message}`);
        }
    }
}
