// Adds `low_stock_threshold` on existing DBs without a full migration pipeline.
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';

@Injectable()
export class IngredientSchemaPatchService implements OnModuleInit {
    private readonly logger = new Logger(IngredientSchemaPatchService.name);

    constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

    async onModuleInit(): Promise<void> {
        const dialect = this.sequelize.getDialect();
        if (dialect !== 'postgres') {
            return;
        }
        try {
            await this.sequelize.query(
                `ALTER TABLE menu_ingredients ADD COLUMN IF NOT EXISTS low_stock_threshold DECIMAL(12,4) NOT NULL DEFAULT 1000`,
            );
        } catch (e) {
            this.logger.warn(`menu_ingredients low_stock_threshold patch: ${(e as Error).message}`);
        }
    }
}
