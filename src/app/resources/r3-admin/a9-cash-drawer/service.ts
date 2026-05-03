// ===========================================================================>> Core Library
import { BadRequestException, Injectable } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { AuditLogService }  from '@app/services/audit-log.service';
import CashDrawer           from '@app/models/cash/cash_drawer.model';
import CashDrawerLog, { CashDrawerLogType } from '@app/models/cash/cash_drawer_log.model';
import User                 from '@app/models/user/user.model';
import { CashDrawerLogQueryDto, DepositCashDto, ResetBalanceDto, WithdrawCashDto } from './dto';

// Denomination field definitions for USD and KHR
export const USD_DENOMS: { field: keyof CashDrawer; face: number }[] = [
    { field: 'usd_100', face: 100 },
    { field: 'usd_50',  face: 50  },
    { field: 'usd_20',  face: 20  },
    { field: 'usd_5',   face: 5   },
    { field: 'usd_1',   face: 1   },
];

export const KHR_DENOMS: { field: keyof CashDrawer; face: number }[] = [
    { field: 'khr_200000', face: 200000 },
    { field: 'khr_100000', face: 100000 },
    { field: 'khr_50000',  face: 50000  },
    { field: 'khr_30000',  face: 30000  },
    { field: 'khr_20000',  face: 20000  },
    { field: 'khr_15000',  face: 15000  },
    { field: 'khr_10000',  face: 10000  },
    { field: 'khr_5000',   face: 5000   },
    { field: 'khr_2000',   face: 2000   },
    { field: 'khr_1000',   face: 1000   },
    { field: 'khr_500',    face: 500    },
    { field: 'khr_200',    face: 200    },
    { field: 'khr_100',    face: 100    },
];

@Injectable()
export class AdminCashDrawerService {

    constructor(private readonly auditLog: AuditLogService) {}

    // ==========================================>> View current drawer
    async getDrawer(): Promise<any> {
        const drawer = await this._getOrCreateDrawer();
        return { data: drawer };
    }

    // ==========================================>> Deposit cash into drawer
    async deposit(body: DepositCashDto, adminId: number): Promise<any> {
        const drawer = await this._getOrCreateDrawer();
        const d = body.denominations;

        const updates: Record<string, number> = {};
        const logDeltas: Record<string, number> = {};

        const allFields = [...USD_DENOMS, ...KHR_DENOMS].map(x => x.field as string);
        for (const field of allFields) {
            const input = (d as any)[field] ?? 0;
            if (input < 0) throw new BadRequestException(`Denomination ${field} cannot be negative.`);
            if (input > 0) {
                updates[field] = (drawer[field as keyof CashDrawer] as number) + input;
                logDeltas[field] = input;
            }
        }

        if (Object.keys(updates).length === 0) {
            throw new BadRequestException('At least one denomination must be greater than 0.');
        }

        await drawer.update(updates as any);

        await CashDrawerLog.create({
            cashier_id: adminId,
            type      : CashDrawerLogType.DEPOSIT,
            note      : body.note ?? null,
            ...logDeltas,
        } as any);

        await this.auditLog.log(adminId, 'CASH_DRAWER_DEPOSIT', {
            denominations: d,
            note         : body.note,
        });

        return {
            data   : await this._getOrCreateDrawer(),
            message: 'Cash deposited successfully.',
        };
    }

    // ==========================================>> Withdraw cash from drawer
    async withdraw(body: WithdrawCashDto, adminId: number): Promise<any> {
        const drawer = await this._getOrCreateDrawer();
        const d = body.denominations;

        const updates: Record<string, number> = {};
        const logDeltas: Record<string, number> = {};

        const allFields = [...USD_DENOMS, ...KHR_DENOMS].map((x) => x.field as string);
        for (const field of allFields) {
            const input = (d as any)[field] ?? 0;
            if (input < 0) throw new BadRequestException(`Denomination ${field} cannot be negative.`);
            if (input > 0) {
                const current = (drawer[field as keyof CashDrawer] as number) ?? 0;
                if (current < input) {
                    throw new BadRequestException(
                        `Not enough ${field} in the drawer (have ${current}, requested ${input}).`,
                    );
                }
                updates[field] = current - input;
                logDeltas[field] = input;
            }
        }

        if (Object.keys(updates).length === 0) {
            throw new BadRequestException('At least one denomination must be greater than 0.');
        }

        await drawer.update(updates as any);

        await CashDrawerLog.create({
            cashier_id: adminId,
            type      : CashDrawerLogType.WITHDRAW,
            note      : body.note ?? null,
            ...logDeltas,
        } as any);

        await this.auditLog.log(adminId, 'CASH_DRAWER_WITHDRAW', {
            denominations: d,
            note         : body.note,
        });

        return {
            data   : await this._getOrCreateDrawer(),
            message: 'Cash withdrawn successfully.',
        };
    }

    // ==========================================>> Reset drawer: zero all denominations (admin)
    async resetBalance(body: ResetBalanceDto, adminId: number): Promise<any> {
        const drawer = await this._getOrCreateDrawer();
        const updates: Record<string, number> = {};
        const logDeltas: Record<string, number> = {};
        let hadAny = false;

        for (const { field } of [...USD_DENOMS, ...KHR_DENOMS]) {
            const current = (drawer[field as keyof CashDrawer] as number) ?? 0;
            updates[field as string] = 0;
            if (current > 0) {
                logDeltas[field as string] = current;
                hadAny = true;
            }
        }

        if (!hadAny) {
            return {
                data   : drawer,
                message: 'Drawer balance is already zero.',
            };
        }

        await drawer.update(updates as any);

        await CashDrawerLog.create({
            cashier_id: adminId,
            type      : CashDrawerLogType.RESET,
            note      : body.note ?? null,
            ...logDeltas,
        } as any);

        await this.auditLog.log(adminId, 'CASH_DRAWER_RESET_BALANCE', {
            note: body.note,
        });

        return {
            data   : await this._getOrCreateDrawer(),
            message: 'Cash drawer balance has been reset to zero.',
        };
    }

    // ==========================================>> View transaction logs
    async getLogs(query: CashDrawerLogQueryDto): Promise<any> {
        const page   = Number(query.page  ?? 1);
        const limit  = Number(query.limit ?? 20);
        const offset = (page - 1) * limit;

        const { rows, count } = await CashDrawerLog.findAndCountAll({
            include: [
                { model: User, as: 'cashier', attributes: ['id', 'name', 'avatar'], required: false },
            ],
            order : [['created_at', 'DESC']],
            limit,
            offset,
        });

        return {
            data      : rows,
            pagination: {
                page,
                limit,
                totalPage: Math.ceil(count / limit),
                total    : count,
            },
        };
    }

    // ==========================================>> Private: get or initialise the single drawer row
    private async _getOrCreateDrawer(): Promise<CashDrawer> {
        const [drawer] = await CashDrawer.findOrCreate({
            where   : { id: 1 },
            defaults: { id: 1 },
        });
        return drawer;
    }
}
