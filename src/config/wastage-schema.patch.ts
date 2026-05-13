import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';

@Injectable()
export class WastageSchemaPatchService implements OnModuleInit {
    private readonly logger = new Logger(WastageSchemaPatchService.name);

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
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wastage_reason') THEN
                        CREATE TYPE wastage_reason AS ENUM ('expired','damaged','spoiled','over_cooked','other');
                    END IF;
                END $$;
            `);
        } catch (e) {
            this.logger.warn(`wastage_reason enum patch: ${(e as Error).message}`);
        }

        try {
            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS ingredient_wastages (
                    id             SERIAL PRIMARY KEY,
                    ingredient_id  INTEGER NOT NULL REFERENCES menu_ingredients(id) ON DELETE CASCADE,
                    created_by     INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
                    reason         wastage_reason NOT NULL,
                    quantity       DECIMAL(10,3) NOT NULL,
                    note           VARCHAR(255),
                    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `);
        } catch (e) {
            this.logger.warn(`ingredient_wastages table patch: ${(e as Error).message}`);
        }

        try {
            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS recipe_wastages (
                    id          SERIAL PRIMARY KEY,
                    menu_id     INTEGER NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
                    created_by  INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
                    reason      wastage_reason NOT NULL,
                    quantity    DECIMAL(10,3) NOT NULL,
                    note        VARCHAR(255),
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `);
        } catch (e) {
            this.logger.warn(`recipe_wastages table patch: ${(e as Error).message}`);
        }

        try {
            await this.sequelize.query(
                `ALTER TABLE menus ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT true`,
            );
        } catch (e) {
            this.logger.warn(`menus is_available column patch: ${(e as Error).message}`);
        }

        try {
            await this.sequelize.query(
                `ALTER TABLE menu_ingredients ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(12,4) NOT NULL DEFAULT 0`,
            );
        } catch (e) {
            this.logger.warn(`menu_ingredients unit_cost column patch: ${(e as Error).message}`);
        }
    }

    private async patchMysql(): Promise<void> {
        try {
            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS ingredient_wastages (
                    id             INT NOT NULL AUTO_INCREMENT,
                    ingredient_id  INT NOT NULL,
                    created_by     INT NULL,
                    reason         ENUM('expired','damaged','spoiled','over_cooked','other') NOT NULL,
                    quantity       DECIMAL(10,3) NOT NULL,
                    note           VARCHAR(255) NULL,
                    created_at     DATETIME NOT NULL,
                    PRIMARY KEY (id),
                    CONSTRAINT fk_iw_ingredient FOREIGN KEY (ingredient_id) REFERENCES menu_ingredients(id) ON DELETE CASCADE,
                    CONSTRAINT fk_iw_creator    FOREIGN KEY (created_by)    REFERENCES user(id) ON DELETE SET NULL
                )
            `);
        } catch (e) {
            this.logger.warn(`ingredient_wastages table patch: ${(e as Error).message}`);
        }

        try {
            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS recipe_wastages (
                    id          INT NOT NULL AUTO_INCREMENT,
                    menu_id     INT NOT NULL,
                    created_by  INT NULL,
                    reason      ENUM('expired','damaged','spoiled','over_cooked','other') NOT NULL,
                    quantity    DECIMAL(10,3) NOT NULL,
                    note        VARCHAR(255) NULL,
                    created_at  DATETIME NOT NULL,
                    PRIMARY KEY (id),
                    CONSTRAINT fk_rw_menu    FOREIGN KEY (menu_id)    REFERENCES menus(id) ON DELETE CASCADE,
                    CONSTRAINT fk_rw_creator FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE SET NULL
                )
            `);
        } catch (e) {
            this.logger.warn(`recipe_wastages table patch: ${(e as Error).message}`);
        }

        for (const sql of [
            'ALTER TABLE `menus` ADD COLUMN is_available TINYINT(1) NOT NULL DEFAULT 1',
            'ALTER TABLE `menu_ingredients` ADD COLUMN unit_cost DECIMAL(12,4) NOT NULL DEFAULT 0',
        ]) {
            try {
                await this.sequelize.query(sql);
            } catch (e) {
                const msg = (e as Error).message || '';
                if (!msg.includes('Duplicate column')) {
                    this.logger.warn(`wastage schema patch: ${msg}`);
                }
            }
        }
    }
}
