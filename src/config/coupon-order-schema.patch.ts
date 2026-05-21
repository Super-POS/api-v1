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
                await this.sequelize.query(`ALTER TABLE coupon ADD COLUMN IF NOT EXISTS usage_limit INTEGER`);
                await this.sequelize.query(`ALTER TABLE coupon ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0`);
                await this.sequelize.query(`ALTER TABLE coupon ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`);
                await this.sequelize.query(`ALTER TABLE coupon DROP COLUMN IF EXISTS assigned_user_id`);
                await this.sequelize.query(`
                    CREATE TABLE IF NOT EXISTS coupon_assigned_user (
                        id SERIAL PRIMARY KEY,
                        coupon_id INTEGER NOT NULL,
                        user_id INTEGER NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        UNIQUE (coupon_id, user_id)
                    )
                `);
                await this.sequelize.query(`
                    CREATE TABLE IF NOT EXISTS coupon_usage (
                        id SERIAL PRIMARY KEY,
                        coupon_id INTEGER NOT NULL,
                        user_id INTEGER NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        UNIQUE (coupon_id, user_id)
                    )
                `);
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
                    await this.sequelize.query('ALTER TABLE `coupon` DROP COLUMN assigned_user_id');
                } catch (_) { /* column may not exist */ }
                try {
                    await this.sequelize.query(`
                        CREATE TABLE IF NOT EXISTS coupon_assigned_user (
                            id INT NOT NULL AUTO_INCREMENT,
                            coupon_id INT NOT NULL,
                            user_id INT NOT NULL,
                            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            PRIMARY KEY (id),
                            UNIQUE KEY uq_coupon_assignment (coupon_id, user_id)
                        )
                    `);
                } catch (e) {
                    this.logger.warn(`coupon_assigned_user table patch: ${(e as Error).message}`);
                }
                for (const sql of [
                    'ALTER TABLE `coupon` ADD COLUMN note TEXT NULL',
                    'ALTER TABLE `coupon` ADD COLUMN usage_limit INT NULL',
                    'ALTER TABLE `coupon` ADD COLUMN usage_count INT NOT NULL DEFAULT 0',
                    'ALTER TABLE `coupon` ADD COLUMN expires_at DATETIME NULL',
                ]) {
                    try {
                        await this.sequelize.query(sql);
                    } catch (e) {
                        const msg = (e as Error).message || '';
                        if (!msg.includes('Duplicate column')) {
                            this.logger.warn(`coupon column patch: ${msg}`);
                        }
                    }
                }
                try {
                    await this.sequelize.query(`
                        CREATE TABLE IF NOT EXISTS coupon_usage (
                            id INT NOT NULL AUTO_INCREMENT,
                            coupon_id INT NOT NULL,
                            user_id INT NOT NULL,
                            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            PRIMARY KEY (id),
                            UNIQUE KEY uq_coupon_usage_per_user (coupon_id, user_id)
                        )
                    `);
                } catch (e) {
                    this.logger.warn(`coupon_usage table patch: ${(e as Error).message}`);
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
