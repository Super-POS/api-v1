import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';

@Injectable()
export class MissionStampSchemaPatchService implements OnModuleInit {
    private readonly logger = new Logger(MissionStampSchemaPatchService.name);

    constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

    async onModuleInit(): Promise<void> {
        if (this.sequelize.getDialect() !== 'postgres') return;

        try {
            // Enums
            await this.sequelize.query(`
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mission_requirement_type_enum') THEN
                        CREATE TYPE mission_requirement_type_enum AS ENUM ('purchase', 'referral', 'event_checkin', 'visit', 'profile_action');
                    END IF;
                END $$;
            `);

            await this.sequelize.query(`
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mission_status_enum') THEN
                        CREATE TYPE mission_status_enum AS ENUM ('active', 'inactive', 'draft');
                    END IF;
                END $$;
            `);

            await this.sequelize.query(`
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stamp_category_enum') THEN
                        CREATE TYPE stamp_category_enum AS ENUM ('drink', 'event', 'community', 'milestone', 'referral');
                    END IF;
                END $$;
            `);

            await this.sequelize.query(`
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_mission_status_enum') THEN
                        CREATE TYPE customer_mission_status_enum AS ENUM ('in_progress', 'completed', 'expired');
                    END IF;
                END $$;
            `);

            await this.sequelize.query(`
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stamp_source_enum') THEN
                        CREATE TYPE stamp_source_enum AS ENUM ('mission', 'direct', 'admin_manual');
                    END IF;
                END $$;
            `);

            // stamp table (created before mission because mission references it)
            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS stamp (
                    id                SERIAL PRIMARY KEY,
                    name              VARCHAR(200) NOT NULL,
                    description       TEXT DEFAULT NULL,
                    category          stamp_category_enum NOT NULL,
                    trigger_condition VARCHAR(500) DEFAULT NULL,
                    points_bonus      INTEGER NOT NULL DEFAULT 0,
                    icon              VARCHAR(500) DEFAULT NULL,
                    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `);

            // mission table
            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS mission (
                    id                       SERIAL PRIMARY KEY,
                    name                     VARCHAR(200) NOT NULL,
                    description              TEXT DEFAULT NULL,
                    requirement_type         mission_requirement_type_enum NOT NULL,
                    target_value             INTEGER NOT NULL DEFAULT 1,
                    reward_points            INTEGER NOT NULL DEFAULT 0,
                    reward_stamp_id          INTEGER DEFAULT NULL REFERENCES stamp(id) ON DELETE SET NULL,
                    status                   mission_status_enum NOT NULL DEFAULT 'draft',
                    start_date               TIMESTAMPTZ DEFAULT NULL,
                    end_date                 TIMESTAMPTZ DEFAULT NULL,
                    max_completions_per_user INTEGER DEFAULT NULL,
                    icon                     VARCHAR(500) DEFAULT NULL,
                    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `);

            // customer_mission table
            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS customer_mission (
                    id           SERIAL PRIMARY KEY,
                    customer_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    mission_id   INTEGER NOT NULL REFERENCES mission(id) ON DELETE CASCADE,
                    progress     INTEGER NOT NULL DEFAULT 0,
                    status       customer_mission_status_enum NOT NULL DEFAULT 'in_progress',
                    completed_at TIMESTAMPTZ DEFAULT NULL,
                    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `);

            await this.sequelize.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_mission_unique
                ON customer_mission (customer_id, mission_id)
                WHERE status = 'in_progress'
            `);

            // customer_stamp table
            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS customer_stamp (
                    id          SERIAL PRIMARY KEY,
                    customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    stamp_id    INTEGER NOT NULL REFERENCES stamp(id) ON DELETE CASCADE,
                    mission_id  INTEGER DEFAULT NULL REFERENCES mission(id) ON DELETE SET NULL,
                    source      stamp_source_enum NOT NULL DEFAULT 'direct',
                    earned_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `);

            await this.sequelize.query(`
                CREATE INDEX IF NOT EXISTS idx_customer_stamp_customer
                ON customer_stamp (customer_id)
            `);

        } catch (e) {
            this.logger.warn(`mission_stamp patch: ${(e as Error).message}`);
        }
    }
}
