import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';

@Injectable()
export class CashDrawerLogEnumPatchService implements OnModuleInit {
    private readonly logger = new Logger(CashDrawerLogEnumPatchService.name);

    constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

    async onModuleInit(): Promise<void> {
        const dialect = this.sequelize.getDialect();
        try {
            if (dialect === 'postgres') {
                for (const typeName of ['enum_cash_drawer_log_type', 'enum_cash_drawer_logs_type']) {
                    for (const value of ['withdraw', 'reset']) {
                        try {
                            await this.sequelize.query(`ALTER TYPE "${typeName}" ADD VALUE '${value}'`);
                        } catch (e) {
                            const msg = (e as Error).message || '';
                            if (!msg.includes('already exists') && !msg.includes('duplicate_object')) {
                                this.logger.debug(`enum ${typeName} add '${value}': ${msg}`);
                            }
                        }
                    }
                }
            } else {
                await this.sequelize.query(`
                    ALTER TABLE cash_drawer_log
                    MODIFY COLUMN type ENUM('deposit','change','withdraw','reset') NOT NULL
                `);
            }
        } catch (e) {
            const msg = (e as Error).message || '';
            if (!msg.includes('Duplicate') && !msg.includes('check that column/key exists')) {
                this.logger.warn(`cash_drawer_log type enum patch: ${msg}`);
            }
        }
    }
}
