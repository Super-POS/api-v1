import CashDrawer from '@app/models/cash/cash_drawer.model';
import CashDrawerLog, { CashDrawerLogType } from '@app/models/cash/cash_drawer_log.model';

const OPENING_FLOAT = {
    // USD bills kept for mixed USD/KHR cash payments.
    usd_1: 50,
    usd_5: 30,
    usd_20: 10,
    usd_50: 4,
    usd_100: 2,

    // KHR notes weighted toward small denominations so cashiers can make exact change.
    khr_100: 40,
    khr_200: 40,
    khr_500: 50,
    khr_1000: 60,
    khr_2000: 40,
    khr_5000: 35,
    khr_10000: 30,
    khr_15000: 10,
    khr_20000: 20,
    khr_30000: 8,
    khr_50000: 10,
    khr_100000: 4,
    khr_200000: 2,
};

export class CashDrawerSeeder {
    public static async seed(): Promise<void> {
        try {
            await CashDrawer.create({
                id: 1,
                ...OPENING_FLOAT,
            } as CashDrawer);

            await CashDrawerLog.create({
                cashier_id: 1,
                order_id: null,
                type: CashDrawerLogType.DEPOSIT,
                ...OPENING_FLOAT,
                exchange_rate: 4100,
                note: 'Opening cash drawer float for POS seed data',
            } as CashDrawerLog);

            console.log('\x1b[32mCash drawer seed data inserted successfully.');
        } catch (error) {
            console.error('\x1b[31m\nError seeding cash drawer data:', error);
            throw error;
        }
    }
}
