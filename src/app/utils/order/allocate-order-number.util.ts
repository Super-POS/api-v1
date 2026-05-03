import { Transaction } from 'sequelize';

import OrderSequenceCounter from '@app/models/order/order-sequence-counter.model';

/** Next short display order number: 1 … 100, then wraps to 1. Must run inside the caller's transaction. */
export async function allocateNextOrderNumber(transaction: Transaction): Promise<number> {
    let row = await OrderSequenceCounter.findByPk(1, {
        transaction,
        lock: Transaction.LOCK.UPDATE,
    });

    if (!row) {
        await OrderSequenceCounter.create({ id: 1, last_assigned: 0 }, { transaction });
        row = await OrderSequenceCounter.findByPk(1, {
            transaction,
            lock: Transaction.LOCK.UPDATE,
        });
    }

    if (!row) {
        throw new Error('order_sequence_counter row missing');
    }

    const last = Number(row.last_assigned);
    const next = last >= 100 ? 1 : last + 1;

    await row.update({ last_assigned: next }, { transaction });

    return next;
}
