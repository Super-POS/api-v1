import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';

@Injectable()
export class RankRewardSchemaPatchService implements OnModuleInit {
    private readonly logger = new Logger(RankRewardSchemaPatchService.name);

    constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

    async onModuleInit(): Promise<void> {
        if (this.sequelize.getDialect() !== 'postgres') return;

        try {
            await this.sequelize.query(`
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rank_reward_type_enum') THEN
                        CREATE TYPE rank_reward_type_enum AS ENUM ('coupon', 'item');
                    END IF;
                END $$;
            `);

            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS coffee_rank_tier_reward (
                    id                      SERIAL PRIMARY KEY,
                    tier_id                 INTEGER NOT NULL REFERENCES coffee_rank_tier(id) ON DELETE CASCADE,
                    type                    rank_reward_type_enum NOT NULL,
                    label                   VARCHAR(200) NOT NULL,
                    description             TEXT DEFAULT NULL,
                    coupon_discount_percent DECIMAL(5,2) DEFAULT NULL,
                    coupon_expires_days     INTEGER DEFAULT NULL,
                    menu_id                 INTEGER DEFAULT NULL REFERENCES menus(id) ON DELETE SET NULL,
                    quantity                INTEGER NOT NULL DEFAULT 1,
                    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `);

            await this.sequelize.query(`
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_rank_reward_status_enum') THEN
                        CREATE TYPE user_rank_reward_status_enum AS ENUM ('pending', 'claimed', 'expired');
                    END IF;
                END $$;
            `);

            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS user_rank_reward (
                    id                SERIAL PRIMARY KEY,
                    customer_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    tier_id           INTEGER NOT NULL REFERENCES coffee_rank_tier(id) ON DELETE CASCADE,
                    reward_id         INTEGER NOT NULL REFERENCES coffee_rank_tier_reward(id) ON DELETE CASCADE,
                    status            user_rank_reward_status_enum NOT NULL DEFAULT 'pending',
                    issued_coupon_id  INTEGER DEFAULT NULL REFERENCES coupon(id) ON DELETE SET NULL,
                    claimed_at        TIMESTAMPTZ DEFAULT NULL,
                    expires_at        TIMESTAMPTZ DEFAULT NULL,
                    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `);

        } catch (e) {
            this.logger.warn(`rank_reward patch: ${(e as Error).message}`);
        }
    }
}
