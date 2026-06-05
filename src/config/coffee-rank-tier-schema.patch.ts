import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';

const INITIAL_TIERS = [
    { tier: 1,  label: 'Green Bean (Starter)',    min_points: 0       },
    { tier: 2,  label: 'Light Roast Recruit',      min_points: 100     },
    { tier: 3,  label: 'City Roast Member',        min_points: 250     },
    { tier: 4,  label: 'Full City Explorer',       min_points: 500     },
    { tier: 5,  label: 'Medium Roast Regular',     min_points: 1000    },
    { tier: 6,  label: 'Vienna Roast Veteran',     min_points: 2500    },
    { tier: 7,  label: 'Dark Roast Devotee',       min_points: 5000    },
    { tier: 8,  label: 'French Roast Champion',    min_points: 10000   },
    { tier: 9,  label: 'Espresso Elite',           min_points: 20000   },
    { tier: 10, label: 'Single Origin Sovereign',  min_points: 35000   },
    { tier: 11, label: 'Reserve Roast Legend',     min_points: 55000   },
    { tier: 12, label: 'Black Label Patron',       min_points: 85000   },
    { tier: 13, label: 'Master Blend Guardian',    min_points: 125000  },
    { tier: 14, label: 'The Signature Pour',       min_points: 175000  },
    { tier: 15, label: 'Infinite Roast',           min_points: 250000  },
];

@Injectable()
export class CoffeeRankTierSchemaPatchService implements OnModuleInit {
    private readonly logger = new Logger(CoffeeRankTierSchemaPatchService.name);

    constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

    async onModuleInit(): Promise<void> {
        if (this.sequelize.getDialect() !== 'postgres') return;

        try {
            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS coffee_rank_tier (
                    id          SERIAL PRIMARY KEY,
                    tier        INTEGER NOT NULL UNIQUE,
                    label       VARCHAR(200) NOT NULL,
                    min_points  INTEGER NOT NULL DEFAULT 0,
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `);

            for (const row of INITIAL_TIERS) {
                await this.sequelize.query(`
                    INSERT INTO coffee_rank_tier (tier, label, min_points, created_at, updated_at)
                    VALUES (:tier, :label, :min_points, NOW(), NOW())
                    ON CONFLICT (tier) DO NOTHING
                `, { replacements: row });
            }
        } catch (e) {
            this.logger.warn(`coffee_rank_tier patch: ${(e as Error).message}`);
        }
    }
}
