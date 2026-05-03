import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';

@Injectable()
export class CouponOrderSchemaPatchService implements OnModuleInit {
    private readonly logger = new Logger(CouponOrderSchemaPatchService.name);

    constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

    async onModuleInit(): Promise<void> {
        const dialect = this.sequelize.getDialect();
        try {
            if (dialect === 'postgres') {
                await this.sequelize.query(`
                    CREATE TABLE IF NOT EXISTS coupon (
                        id SERIAL PRIMARY KEY,
                        code VARCHAR(64) NOT NULL UNIQUE,
                        discount_percent DECIMAL(5,2) NOT NULL,
                        is_active BOOLEAN NOT NULL DEFAULT true,
                        note TEXT,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                `);
                await this.sequelize.query(`ALTER TABLE coupon ADD COLUMN IF NOT EXISTS note TEXT`);
                await this.sequelize.query(
                    `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS coupon_id INTEGER`,
                );
                await this.sequelize.query(
                    `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(64)`,
                );
                await this.sequelize.query(
                    `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS discount_percent DOUBLE PRECISION`,
                );
                await this.sequelize.query(
                    `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS discount_amount DOUBLE PRECISION`,
                );
            } else {
                await this.sequelize.query(`
                    CREATE TABLE IF NOT EXISTS coupon (
                        id INT NOT NULL AUTO_INCREMENT,
                        code VARCHAR(64) NOT NULL,
                        discount_percent DECIMAL(5,2) NOT NULL,
                        is_active TINYINT(1) NOT NULL DEFAULT 1,
                        note TEXT NULL,
                        created_at DATETIME NOT NULL,
                        updated_at DATETIME NOT NULL,
                        PRIMARY KEY (id),
                        UNIQUE KEY coupon_code_unique (code)
                    )
                `);
                try {
                    await this.sequelize.query('ALTER TABLE `coupon` ADD COLUMN note TEXT NULL');
                } catch (e) {
                    const msg = (e as Error).message || '';
                    if (!msg.includes('Duplicate column')) {
                        this.logger.warn(`coupon note column patch: ${msg}`);
                    }
                }
                for (const sql of [
                    'ALTER TABLE `order` ADD COLUMN coupon_id INT NULL',
                    'ALTER TABLE `order` ADD COLUMN coupon_code VARCHAR(64) NULL',
                    'ALTER TABLE `order` ADD COLUMN discount_percent DOUBLE NULL',
                    'ALTER TABLE `order` ADD COLUMN discount_amount DOUBLE NULL',
                ]) {
                    try {
                        await this.sequelize.query(sql);
                    } catch (e) {
                        const msg = (e as Error).message || '';
                        if (!msg.includes('Duplicate column')) {
                            this.logger.warn(`coupon/order column patch: ${msg}`);
                        }
                    }
                }
            }
        } catch (e) {
            this.logger.warn(`coupon/order schema patch: ${(e as Error).message}`);
        }
    }
}
