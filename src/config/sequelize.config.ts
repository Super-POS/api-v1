// ===========================================================================>> Core Library
import { SequelizeModuleOptions } from '@nestjs/sequelize';

// ===========================================================================>> Third Party Library
import * as dotenv from 'dotenv';
import { Dialect } from 'sequelize';

dotenv.config();

/** Normalize driver name; Sequelize expects `postgres`, not `postgresql`. */
function resolveDialect(): Dialect {
    const raw = (process.env.DB_CONNECTION || 'postgres').trim().toLowerCase();
    if (!raw || raw === 'postgresql') {
        return 'postgres';
    }
    return raw as Dialect;
}

/** Default `postgres` matches Docker Compose and avoids MySQL-only types (e.g. TINYINT) on PostgreSQL. */
const sequelizeConfig: SequelizeModuleOptions = {
    dialect     : resolveDialect(),
    host        : process.env.DB_HOST,
    port        : Number(process.env.DB_PORT),
    username    : process.env.DB_USERNAME,
    password    : process.env.DB_PASSWORD,
    database    : process.env.DB_DATABASE,
    timezone    : process.env.DB_TIMEZONE || 'Asia/Phnom_Penh',
    models      : [__dirname + '/../app/models/**/*.model.{ts,js}'],
    logging     : false
};

export default sequelizeConfig;
