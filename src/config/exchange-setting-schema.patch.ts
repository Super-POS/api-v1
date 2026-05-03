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
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            `);
            await this.sequelize.query(`
                INSERT INTO pos_exchange_setting (id, khr_per_usd)
                VALUES (1, 4100)
                ON CONFLICT (id) DO NOTHING
            `);
        } catch (e) {
            this.logger.warn(`pos_exchange_setting patch: ${(e as Error).message}`);
        }
    }
}
