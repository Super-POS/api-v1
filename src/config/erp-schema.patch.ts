import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';

@Injectable()
export class ErpSchemaPatchService implements OnModuleInit {
    private readonly logger = new Logger(ErpSchemaPatchService.name);

    constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

    async onModuleInit(): Promise<void> {
        await this.patch();
    }

    private async patch(): Promise<void> {
        const queries: { sql: string; label: string }[] = [
            {
                label: 'expense_type enum',
                sql: `
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expense_type') THEN
                            CREATE TYPE expense_type AS ENUM ('fixed', 'variable');
                        END IF;
                    END $$;
                `,
            },
            {
                label: 'payroll_status enum',
                sql: `
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_status') THEN
                            CREATE TYPE payroll_status AS ENUM ('draft', 'finalized', 'paid');
                        END IF;
                    END $$;
                `,
            },
            {
                label: 'erp_expense_categories table',
                sql: `
                    CREATE TABLE IF NOT EXISTS erp_expense_categories (
                        id          SERIAL PRIMARY KEY,
                        name        VARCHAR(100) NOT NULL UNIQUE,
                        type        expense_type NOT NULL DEFAULT 'variable',
                        description TEXT
                    );
                `,
            },
            {
                label: 'erp_operating_expenses table',
                sql: `
                    CREATE TABLE IF NOT EXISTS erp_operating_expenses (
                        id          SERIAL PRIMARY KEY,
                        category_id INTEGER      NOT NULL REFERENCES erp_expense_categories(id) ON DELETE RESTRICT,
                        amount      DECIMAL(14,2) NOT NULL DEFAULT 0,
                        currency    VARCHAR(10)  NOT NULL DEFAULT 'USD',
                        description TEXT,
                        date        DATE         NOT NULL,
                        reference   VARCHAR(100),
                        created_by  INTEGER      REFERENCES "user"(id) ON DELETE SET NULL,
                        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
                    );
                `,
            },
            {
                label: 'erp_payrolls table',
                sql: `
                    CREATE TABLE IF NOT EXISTS erp_payrolls (
                        id           SERIAL PRIMARY KEY,
                        period_start DATE          NOT NULL,
                        period_end   DATE          NOT NULL,
                        total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
                        status       payroll_status NOT NULL DEFAULT 'draft',
                        created_by   INTEGER       REFERENCES "user"(id) ON DELETE SET NULL,
                        notes        TEXT,
                        created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
                        updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
                    );
                `,
            },
        ];

        for (const { sql, label } of queries) {
            try {
                await this.sequelize.query(sql);
            } catch (e) {
                this.logger.warn(`ERP schema patch [${label}]: ${(e as Error).message}`);
            }
        }
    }
}
