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
            {
                label: 'purchase_order_status enum',
                sql: `
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchase_order_status') THEN
                            CREATE TYPE purchase_order_status AS ENUM ('draft', 'ordered', 'partial', 'received', 'cancelled');
                        END IF;
                    END $$;
                `,
            },
            {
                label: 'employee_contract_type enum',
                sql: `
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employee_contract_type') THEN
                            CREATE TYPE employee_contract_type AS ENUM ('full_time', 'part_time', 'contract', 'internship');
                        END IF;
                    END $$;
                `,
            },
            {
                label: 'employee_status enum',
                sql: `
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employee_status') THEN
                            CREATE TYPE employee_status AS ENUM ('active', 'inactive', 'terminated');
                        END IF;
                    END $$;
                `,
            },
            {
                label: 'attendance_status enum',
                sql: `
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
                            CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'half_day', 'holiday', 'on_leave');
                        END IF;
                    END $$;
                `,
            },
            {
                label: 'leave_type enum',
                sql: `
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_type') THEN
                            CREATE TYPE leave_type AS ENUM ('annual', 'sick', 'unpaid', 'maternity', 'paternity', 'other');
                        END IF;
                    END $$;
                `,
            },
            {
                label: 'leave_status enum',
                sql: `
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_status') THEN
                            CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
                        END IF;
                    END $$;
                `,
            },
            {
                label: 'erp_suppliers table',
                sql: `
                    CREATE TABLE IF NOT EXISTS erp_suppliers (
                        id             SERIAL PRIMARY KEY,
                        name           VARCHAR(150) NOT NULL,
                        contact_person VARCHAR(100),
                        phone          VARCHAR(30),
                        email          VARCHAR(150),
                        address        TEXT,
                        payment_terms  VARCHAR(100),
                        is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
                        notes          TEXT,
                        created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                        updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
                    );
                `,
            },
            {
                label: 'erp_employees table',
                sql: `
                    CREATE TABLE IF NOT EXISTS erp_employees (
                        id               SERIAL PRIMARY KEY,
                        user_id          INTEGER                NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
                        position         VARCHAR(100)           NOT NULL,
                        department       VARCHAR(100),
                        base_salary      DECIMAL(12,2)          NOT NULL DEFAULT 0,
                        hourly_rate      DECIMAL(12,2)          NOT NULL DEFAULT 0,
                        hire_date        DATE                   NOT NULL,
                        termination_date DATE,
                        contract_type    employee_contract_type NOT NULL DEFAULT 'full_time',
                        bank_account     VARCHAR(100),
                        bank_name        VARCHAR(100),
                        status           employee_status        NOT NULL DEFAULT 'active',
                        notes            TEXT,
                        created_at       TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
                        updated_at       TIMESTAMPTZ            NOT NULL DEFAULT NOW()
                    );
                `,
            },
            {
                label: 'erp_purchase_orders table',
                sql: `
                    CREATE TABLE IF NOT EXISTS erp_purchase_orders (
                        id            SERIAL PRIMARY KEY,
                        po_number     VARCHAR(50)           NOT NULL UNIQUE,
                        supplier_id   INTEGER               NOT NULL REFERENCES erp_suppliers(id) ON DELETE RESTRICT,
                        order_date    DATE                  NOT NULL,
                        expected_date DATE,
                        received_date DATE,
                        total_amount  DECIMAL(14,2)         NOT NULL DEFAULT 0,
                        status        purchase_order_status NOT NULL DEFAULT 'draft',
                        created_by    INTEGER               REFERENCES "user"(id) ON DELETE SET NULL,
                        notes         TEXT,
                        created_at    TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
                        updated_at    TIMESTAMPTZ           NOT NULL DEFAULT NOW()
                    );
                `,
            },
            {
                label: 'erp_purchase_order_items table',
                sql: `
                    CREATE TABLE IF NOT EXISTS erp_purchase_order_items (
                        id                SERIAL PRIMARY KEY,
                        po_id             INTEGER       NOT NULL REFERENCES erp_purchase_orders(id) ON DELETE CASCADE,
                        ingredient_id     INTEGER       REFERENCES menu_ingredients(id) ON DELETE SET NULL,
                        item_name         VARCHAR(150)  NOT NULL,
                        quantity          DECIMAL(12,3) NOT NULL DEFAULT 0,
                        received_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
                        unit              VARCHAR(30),
                        unit_cost         DECIMAL(12,4) NOT NULL DEFAULT 0,
                        total_cost        DECIMAL(14,2) NOT NULL DEFAULT 0
                    );
                `,
            },
            {
                label: 'erp_payroll_items table',
                sql: `
                    CREATE TABLE IF NOT EXISTS erp_payroll_items (
                        id               SERIAL PRIMARY KEY,
                        payroll_id       INTEGER       NOT NULL REFERENCES erp_payrolls(id) ON DELETE CASCADE,
                        employee_id      INTEGER       NOT NULL REFERENCES erp_employees(id) ON DELETE CASCADE,
                        base_salary      DECIMAL(12,2) NOT NULL DEFAULT 0,
                        overtime_hours   DECIMAL(5,2)  NOT NULL DEFAULT 0,
                        overtime_pay     DECIMAL(12,2) NOT NULL DEFAULT 0,
                        working_days     INTEGER       NOT NULL DEFAULT 0,
                        attended_days    INTEGER       NOT NULL DEFAULT 0,
                        leave_days       DECIMAL(5,1)  NOT NULL DEFAULT 0,
                        leave_deduction  DECIMAL(12,2) NOT NULL DEFAULT 0,
                        other_deductions DECIMAL(12,2) NOT NULL DEFAULT 0,
                        net_salary       DECIMAL(12,2) NOT NULL DEFAULT 0,
                        notes            TEXT,
                        created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
                    );
                `,
            },
            {
                label: 'erp_attendance table',
                sql: `
                    CREATE TABLE IF NOT EXISTS erp_attendance (
                        id             SERIAL PRIMARY KEY,
                        employee_id    INTEGER           NOT NULL REFERENCES erp_employees(id) ON DELETE CASCADE,
                        date           DATE              NOT NULL,
                        clock_in       TIME,
                        clock_out      TIME,
                        hours_worked   DECIMAL(5,2)      NOT NULL DEFAULT 0,
                        overtime_hours DECIMAL(5,2)      NOT NULL DEFAULT 0,
                        status         attendance_status NOT NULL DEFAULT 'present',
                        notes          TEXT,
                        created_at     TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
                        updated_at     TIMESTAMPTZ       NOT NULL DEFAULT NOW()
                    );
                `,
            },
            {
                label: 'erp_leaves table',
                sql: `
                    CREATE TABLE IF NOT EXISTS erp_leaves (
                        id               SERIAL PRIMARY KEY,
                        employee_id      INTEGER      NOT NULL REFERENCES erp_employees(id) ON DELETE CASCADE,
                        type             leave_type   NOT NULL DEFAULT 'annual',
                        start_date       DATE         NOT NULL,
                        end_date         DATE         NOT NULL,
                        days             DECIMAL(5,1) NOT NULL DEFAULT 1,
                        reason           TEXT,
                        status           leave_status NOT NULL DEFAULT 'pending',
                        approved_by      INTEGER      REFERENCES "user"(id) ON DELETE SET NULL,
                        rejection_reason TEXT,
                        created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                        updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
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
