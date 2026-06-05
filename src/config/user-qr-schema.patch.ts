import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';

@Injectable()
export class UserQrSchemaPatchService implements OnModuleInit {
    private readonly logger = new Logger(UserQrSchemaPatchService.name);

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
        const sql = `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS qr_code TEXT DEFAULT NULL;`;
        try {
            await this.sequelize.query(sql);
        } catch (e) {
            this.logger.warn(`user qr patch (postgres): ${(e as Error).message}`);
        }
    }

    private async patchMysql(): Promise<void> {
        try {
            const [[{ cnt }]] = await this.sequelize.query(`
                SELECT COUNT(*) AS cnt FROM information_schema.columns
                WHERE table_name = 'user' AND column_name = 'qr_code';
            `) as any;
            if (Number(cnt) === 0) {
                await this.sequelize.query(`ALTER TABLE \`user\` ADD COLUMN qr_code TEXT DEFAULT NULL;`);
            }
        } catch (e) {
            this.logger.warn(`user qr patch (mysql): ${(e as Error).message}`);
        }
    }
}
