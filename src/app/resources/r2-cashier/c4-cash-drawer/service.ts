// ===========================================================================>> Core Library
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { AuditLogService }   from '@app/services/audit-log.service';
import CashDrawer            from '@app/models/cash/cash_drawer.model';
import CashDrawerLog, { CashDrawerLogType } from '@app/models/cash/cash_drawer_log.model';
import Order                 from '@app/models/order/order.model';
import User                  from '@app/models/user/user.model';
import { MakeChangeDto, PreviewChangeDto, ReceivedDenominationsDto } from './dto';

const DEFAULT_EXCHANGE_RATE = 4100; // KHR per 1 USD

// =====================================================================
// Denomination definitions sorted descending by face value in KHR.
// This list is used by the greedy change algorithm.
// =====================================================================
type DenomDef = { field: keyof CashDrawer; faceKhr: number };
type ChangeInput = MakeChangeDto | PreviewChangeDto;

function buildDenomList(rate: number): DenomDef[] {
    const usd: DenomDef[] = [
        { field: 'usd_100', faceKhr: 100 * rate },
        { field: 'usd_50',  faceKhr: 50  * rate },
        { field: 'usd_20',  faceKhr: 20  * rate },
    ];
    const khr1: DenomDef[] = [
        { field: 'khr_200000', faceKhr: 200000 },
        { field: 'khr_100000', faceKhr: 100000 },
        { field: 'khr_50000',  faceKhr: 50000  },
        { field: 'khr_30000',  faceKhr: 30000  },
        { field: 'khr_20000',  faceKhr: 20000  },
        { field: 'khr_15000',  faceKhr: 15000  },
        { field: 'khr_10000',  faceKhr: 10000  },
        { field: 'khr_5000',   faceKhr: 5000   },
    ];
    const usdSmall: DenomDef[] = [
        { field: 'usd_5',   faceKhr: 5 * rate },
        { field: 'usd_1',   faceKhr: 1 * rate },
    ];
    const khr2: DenomDef[] = [
        { field: 'khr_2000',   faceKhr: 2000 },
        { field: 'khr_1000',   faceKhr: 1000 },
        { field: 'khr_500',    faceKhr: 500  },
        { field: 'khr_200',    faceKhr: 200  },
        { field: 'khr_100',    faceKhr: 100  },
    ];

    return [...usd, ...khr1, ...usdSmall, ...khr2].sort((a, b) => b.faceKhr - a.faceKhr);
}

@Injectable()
export class CashierCashDrawerService {

    constructor(private readonly auditLog: AuditLogService) {}

    // ==========================================>> View current drawer
    async getDrawer(): Promise<any> {
        const drawer = await this._getOrCreateDrawer();
        return { data: drawer };
    }

    // ==========================================>> Preview change without creating logs or updating drawer
    async previewChange(body: PreviewChangeDto): Promise<any> {
        const rate = body.exchange_rate ?? DEFAULT_EXCHANGE_RATE;
        const orderTotalKhr = Math.round(Number(body.order_total_khr ?? 0));
        if (orderTotalKhr <= 0) throw new BadRequestException('Order total must be greater than 0.');

        const preview = await this._prepareChange(orderTotalKhr, body, rate);
        return {
            data: {
                exchange_rate: rate,
                received_khr: preview.receivedKhr,
                order_total_khr: orderTotalKhr,
                change_khr: preview.changeKhr,
                change_breakdown: preview.changeResult,
                change_summary: preview.changeSummary,
                drawer: preview.drawer,
            },
            message: 'Change preview calculated successfully.',
        };
    }

    // ==========================================>> Process payment and give change
    async makeChange(body: MakeChangeDto, cashierId: number): Promise<any> {
        const rate = body.exchange_rate ?? DEFAULT_EXCHANGE_RATE;

        // Fetch the order
        const order = await Order.findByPk(body.order_id, {
            attributes: ['id', 'receipt_number', 'total_price', 'status'],
        });
        if (!order) throw new NotFoundException('Order not found.');

        const orderTotalKhr = Math.round(Number(order.total_price ?? 0));
        if (orderTotalKhr <= 0) throw new BadRequestException('Order has no payable amount.');

        const prepared = await this._prepareChange(orderTotalKhr, body, rate);

        // ---- Step 3: Build final drawer updates (add received, deduct change) ----
        const finalUpdates: Record<string, number> = { ...prepared.addUpdates };
        const deductDeltas: Record<string, number> = {};

        for (const [field, count] of Object.entries(prepared.changeResult)) {
            if (count > 0) {
                const current = (finalUpdates[field as keyof CashDrawer] ?? prepared.drawer[field as keyof CashDrawer]) as number;
                (finalUpdates as any)[field] = current - count;
                deductDeltas[field]          = count;
            }
        }

        await prepared.drawer.update(finalUpdates as any);

        // ---- Step 4: Log the transaction (net delta per denomination) ----
        const logEntry: Record<string, any> = {
            cashier_id   : cashierId,
            order_id     : order.id,
            type         : CashDrawerLogType.CHANGE,
            exchange_rate: rate,
            note         : body.note ?? `Change for order #${order.receipt_number}`,
        };
        for (const field of prepared.allDenomFields) {
            const added   = (prepared.addDeltas[field as string]   ?? 0) as number;
            const deducted = (deductDeltas[field as string] ?? 0) as number;
            logEntry[field as string] = added - deducted;
        }
        await CashDrawerLog.create(logEntry);

        await this.auditLog.log(cashierId, 'CASH_DRAWER_CHANGE', {
            orderId      : order.id,
            receiptNumber: order.receipt_number,
            orderTotalKhr,
            receivedKhr: prepared.receivedKhr,
            changeKhr: prepared.changeKhr,
            changeDenominations: prepared.changeResult,
            exchangeRate : rate,
        });

        return {
            data: {
                order          : { id: order.id, receipt_number: order.receipt_number, total_price: orderTotalKhr },
                exchange_rate  : rate,
                received_khr   : prepared.receivedKhr,
                order_total_khr: orderTotalKhr,
                change_khr     : prepared.changeKhr,
                change_breakdown: prepared.changeResult,
                change_summary : prepared.changeSummary,
                drawer         : await this._getOrCreateDrawer(),
            },
            message: 'Change calculated and drawer updated successfully.',
        };
    }

    // ==========================================>> Helpers

    private async _prepareChange(orderTotalKhr: number, body: ChangeInput, rate: number): Promise<{
        recv: ReceivedDenominationsDto;
        receivedKhr: number;
        changeKhr: number;
        drawer: CashDrawer;
        allDenomFields: (keyof CashDrawer)[];
        addUpdates: Record<string, number>;
        addDeltas: Record<string, number>;
        changeResult: Record<string, number>;
        changeSummary: { usd: number; khr: number };
    }> {
        const recv = this._normalizeReceivedCash(body, rate);
        const receivedKhr = this._denominationsToKhr(recv, rate);

        if (receivedKhr < orderTotalKhr) {
            throw new BadRequestException(
                `Insufficient payment. Required: ${orderTotalKhr} KHR, ` +
                `but received: ${receivedKhr} KHR.`,
            );
        }

        const changeKhr = receivedKhr - orderTotalKhr;
        const drawer = await this._getOrCreateDrawer();
        const addUpdates: Record<string, number> = {};
        const addDeltas:  Record<string, number> = {};
        const allDenomFields = buildDenomList(rate).map(d => d.field);

        for (const field of allDenomFields) {
            const count = (recv as any)[field] ?? 0;
            if (count > 0) {
                addUpdates[field] = (drawer[field] as number) + count;
                addDeltas[field]  = count;
            }
        }

        const drawerSnapshot: Record<string, number> = {};
        for (const field of allDenomFields) {
            drawerSnapshot[field as string] = ((drawer[field] as number) ?? 0) + ((addDeltas[field as string] ?? 0));
        }

        const changeResult = this._computeChange(changeKhr, drawerSnapshot, rate);
        if (changeResult === null) {
            throw new BadRequestException(
                `Cannot make exact change of ${changeKhr} KHR from the available drawer denominations. ` +
                `Please top up the cash drawer.`,
            );
        }

        return {
            recv,
            receivedKhr,
            changeKhr,
            drawer,
            allDenomFields,
            addUpdates,
            addDeltas,
            changeResult,
            changeSummary: this._buildChangeSummary(changeResult, rate),
        };
    }

    private _normalizeReceivedCash(body: ChangeInput, rate: number): ReceivedDenominationsDto {
        const amountKhr = Number(body.received_amount_khr ?? 0);
        const amountUsd = Number(body.received_amount_usd ?? 0);
        if (amountKhr > 0 || amountUsd > 0) {
            return this._amountsToDenominations(amountKhr, amountUsd, rate);
        }

        const received = body.received ?? {};
        if (Object.values(received).some((count) => Number(count) > 0)) {
            return received;
        }

        throw new BadRequestException('Please enter the cash received from the customer.');
    }

    private _amountsToDenominations(amountKhr: number, amountUsd: number, rate: number): ReceivedDenominationsDto {
        if (!Number.isInteger(amountKhr) || amountKhr < 0) {
            throw new BadRequestException('KHR received amount must be a whole number.');
        }
        if (!Number.isInteger(amountUsd) || amountUsd < 0) {
            throw new BadRequestException('USD received amount must be a whole number because the drawer tracks bills only.');
        }

        const received: ReceivedDenominationsDto = {};
        let remainingUsd = amountUsd;
        const usdDenoms: { key: keyof ReceivedDenominationsDto; value: number }[] = [
            { key: 'usd_100', value: 100 },
            { key: 'usd_50', value: 50 },
            { key: 'usd_20', value: 20 },
            { key: 'usd_5', value: 5 },
            { key: 'usd_1', value: 1 },
        ];
        for (const denom of usdDenoms) {
            const count = Math.floor(remainingUsd / denom.value);
            if (count > 0) {
                received[denom.key] = count;
                remainingUsd -= count * denom.value;
            }
        }

        let remainingKhr = amountKhr;
        const khrDenoms: { key: keyof ReceivedDenominationsDto; value: number }[] = [
            { key: 'khr_200000', value: 200000 },
            { key: 'khr_100000', value: 100000 },
            { key: 'khr_50000', value: 50000 },
            { key: 'khr_30000', value: 30000 },
            { key: 'khr_20000', value: 20000 },
            { key: 'khr_15000', value: 15000 },
            { key: 'khr_10000', value: 10000 },
            { key: 'khr_5000', value: 5000 },
            { key: 'khr_2000', value: 2000 },
            { key: 'khr_1000', value: 1000 },
            { key: 'khr_500', value: 500 },
            { key: 'khr_200', value: 200 },
            { key: 'khr_100', value: 100 },
        ];
        for (const denom of khrDenoms) {
            const count = Math.floor(remainingKhr / denom.value);
            if (count > 0) {
                received[denom.key] = count;
                remainingKhr -= count * denom.value;
            }
        }

        if (remainingUsd !== 0 || remainingKhr !== 0) {
            throw new BadRequestException(
                `Received amount cannot be represented by supported drawer denominations at rate ${rate}.`,
            );
        }

        return received;
    }

    private _denominationsToKhr(recv: ReceivedDenominationsDto, rate: number): number {
        const usdTotal =
            ((recv.usd_1   ?? 0) * 1   +
             (recv.usd_5   ?? 0) * 5   +
             (recv.usd_20  ?? 0) * 20  +
             (recv.usd_50  ?? 0) * 50  +
             (recv.usd_100 ?? 0) * 100) * rate;

        const khrTotal =
            (recv.khr_100    ?? 0) * 100    +
            (recv.khr_200    ?? 0) * 200    +
            (recv.khr_500    ?? 0) * 500    +
            (recv.khr_1000   ?? 0) * 1000   +
            (recv.khr_2000   ?? 0) * 2000   +
            (recv.khr_5000   ?? 0) * 5000   +
            (recv.khr_10000  ?? 0) * 10000  +
            (recv.khr_15000  ?? 0) * 15000  +
            (recv.khr_20000  ?? 0) * 20000  +
            (recv.khr_30000  ?? 0) * 30000  +
            (recv.khr_50000  ?? 0) * 50000  +
            (recv.khr_100000 ?? 0) * 100000 +
            (recv.khr_200000 ?? 0) * 200000;

        return Math.round(usdTotal) + khrTotal;
    }

    /**
     * Greedy algorithm: find minimum number of notes/bills to make `changeKhr`
     * from the current drawer snapshot. Returns null if exact change is impossible.
     */
    private _computeChange(
        changeKhr      : number,
        drawerSnapshot : Record<string, number>,
        rate           : number,
    ): Record<string, number> | null {
        if (changeKhr === 0) return {};

        const denoms = buildDenomList(rate);
        const result: Record<string, number> = {};
        let remaining = changeKhr;

        for (const { field, faceKhr } of denoms) {
            if (remaining <= 0) break;
            const available = drawerSnapshot[field as string] ?? 0;
            if (available <= 0) continue;

            const needed = Math.floor(remaining / faceKhr);
            const use    = Math.min(needed, available);
            if (use > 0) {
                result[field as string] = use;
                remaining -= use * faceKhr;
            }
        }

        if (remaining !== 0) return null;
        return result;
    }

    private _buildChangeSummary(
        changeResult: Record<string, number>,
        rate        : number,
    ): { usd: number; khr: number } {
        let usd = 0;
        let khr = 0;
        for (const [field, count] of Object.entries(changeResult)) {
            if (count <= 0) continue;
            if (field.startsWith('usd_')) {
                const face = parseInt(field.replace('usd_', ''), 10);
                usd += face * count;
            } else {
                const face = parseInt(field.replace('khr_', ''), 10);
                khr += face * count;
            }
        }
        return { usd, khr };
    }

    private async _getOrCreateDrawer(): Promise<CashDrawer> {
        const [drawer] = await CashDrawer.findOrCreate({
            where   : { id: 1 },
            defaults: { id: 1 },
        });
        return drawer;
    }
}
