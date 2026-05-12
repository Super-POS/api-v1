// ================================================================>> Third Party Library
import { Sequelize } from 'sequelize-typescript';
import "colors";

// ================================================================>> Custom Library
import sequelizeConfig from '@config/sequelize.config';

/**
 * Safe sync — only CREATES tables that do not yet exist.
 * Never drops, never alters, never touches existing data.
 */
class SafeSyncInitializer {

    private sequelize: Sequelize;

    constructor() {
        this.sequelize = new Sequelize(sequelizeConfig);
        console.log('\x1b[36m%s\x1b[0m', `Sequelize dialect: ${this.sequelize.getDialect()}`);
    }

    public async run() {
        try {
            // sync() with no options = CREATE TABLE IF NOT EXISTS only
            await this.sequelize.sync();
            console.log('\nSafe sync completed — new tables created, existing data untouched.'.green);
            process.exit(0);
        } catch (error) {
            console.log('\x1b[31m%s\x1b[0m', (error as Error).message);
            process.exit(1);
        }
    }
}

const initializer = new SafeSyncInitializer();
initializer.run();
