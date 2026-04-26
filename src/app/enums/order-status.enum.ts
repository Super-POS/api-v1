export enum OrderStatusEnum {
    /** Baray: pay link created; not shown in kitchen until Baray payment clears (webhook). */
    AWAITING_PAYMENT = 'awaiting_payment',
    PENDING   = 'pending',
    PREPARING = 'preparing',
    READY     = 'ready',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
}
