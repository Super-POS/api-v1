import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';

@Injectable()
export class OrderNumberSchemaPatchService implements OnModuleInit {
    private readonly logger = new Logger(OrderNumberSchemaPatchService.name);

    constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

    async onModuleInit(): Promise<void> {
        const dialect = this.sequelize.getDialect();
        try {
            if (dialect === 'postgres') {
                await this.sequelize.query(`
                    CREATE TABLE IF NOT EXISTS order_sequence_counter (
                        id SMALLINT PRIMARY KEY CHECK (id = 1),
                        last_assigned SMALLINT NOT NULL DEFAULT 0
                    )
                `);
                await this.sequelize.query(`
                    INSERT INTO order_sequence_counter (id, last_assigned)
                    VALUES (1, 0)
                    ON CONFLICT (id) DO NOTHING
                `);
                await this.sequelize.query(
                    `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS order_number SMALLINT`,
                );
            } else {
                await this.sequelize.query(`
                    CREATE TABLE IF NOT EXISTS order_sequence_counter (
                        id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
                        last_assigned SMALLINT UNSIGNED NOT NULL DEFAULT 0
                    )
                `);
                await this.sequelize.query(`
                    INSERT IGNORE INTO order_sequence_counter (id, last_assigned) VALUES (1, 0)
                `);
                try {
                    await this.sequelize.query(
                        'ALTER TABLE `order` ADD COLUMN order_number SMALLINT UNSIGNED NULL',
                    );
                } catch (e) {
                    const msg = (e as Error).message || '';
                    if (!msg.includes('Duplicate column')) {
                        this.logger.warn(`order.order_number column patch: ${msg}`);
                    }
                }
            }
        } catch (e) {
            this.logger.warn(`order number schema patch: ${(e as Error).message}`);
        }
    }
}
