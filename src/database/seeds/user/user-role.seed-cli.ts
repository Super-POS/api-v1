import 'colors';
import { Sequelize } from 'sequelize-typescript';
import sequelizeConfig from '@config/sequelize.config';
import { ensureSuperUserStaffRoles } from './super-user-roles.patch';

async function main(): Promise<void> {
    const sequelize = new Sequelize(sequelizeConfig);
    try {
        await sequelize.authenticate();
        await ensureSuperUserStaffRoles();
        console.log('\x1b[32m%s\x1b[0m', 'Super User staff roles patched (Admin + Cashier + Super User).');
    } catch (e) {
        console.error('\x1b[31m%s\x1b[0m', (e as Error).message);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
    process.exit(0);
}

void main();
