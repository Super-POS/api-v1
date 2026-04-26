import { OrderChannelEnum }  from '@app/enums/order-channel.enum';
import { OrderStatusEnum }   from '@app/enums/order-status.enum';
import OrderDetails          from '@app/models/order/detail.model';
import Order                 from '@app/models/order/order.model';
import Notifications         from '@app/models/notification/notification.model';
import PaymentTransaction, { PaymentMethod, PaymentStatus } from '@app/models/payment/payment_transaction.model';
import Product               from '@app/models/product/product.model';
import RewardPoint           from '@app/models/reward/reward_point.model';
import RewardTransaction, { RewardTransactionType } from '@app/models/reward/reward_transaction.model';
import UsersLogs             from '@app/models/user/user_logs.model';
import Wallet                from '@app/models/wallet/wallet.model';
import WalletTransaction, { DepositStatus, WalletTransactionType } from '@app/models/wallet/wallet_transaction.model';

// ─── ID constants ─────────────────────────────────────────────────────────────
const ADMIN_ID    = 1;
const CASHIER_IDS = [1, 2, 3];     // user ids that are cashiers
const CUSTOMER_IDS= [4, 5, 6, 7, 8]; // user ids that are customers

// ─── Popular products (weighted for realistic cafe orders) ────────────────────
// [product_id, weight]  higher weight = ordered more often
const POPULAR_PRODUCTS: [number, number][] = [
    [3,  12], // Cafe Latte
    [4,  10], // Cappuccino
    [15, 10], // Iced Cafe Latte
    [6,   9], // Caramel Macchiato
    [9,   9], // Matcha Latte
    [17,  8], // Brown Sugar Iced Latte
    [2,   8], // Americano
    [14,  8], // Iced Americano
    [7,   7], // Mocha
    [5,   7], // Flat White
    [16,  7], // Iced Matcha Latte
    [10,  6], // Thai Milk Tea
    [1,   5], // Espresso
    [8,   5], // Dirty Matcha
    [13,  5], // Cold Brew Classic
    [18,  8], // Butter Croissant
    [19,  6], // Cheesecake Slice
    [21,  5], // Chocolate Muffin
    [20,  4], // Banana Bread
    [22,  3], // Avocado Toast
    [23,  5], // Strawberry Smoothie
    [24,  5], // Mango Smoothie
    [25,  4], // Fresh Orange Juice
    [11,  3], // Chamomile Tea
    [12,  4], // Taro Milk Tea
];

// ─── Total weight for weighted-random pick ────────────────────────────────────
const TOTAL_WEIGHT = POPULAR_PRODUCTS.reduce((s, [, w]) => s + w, 0);

// ─── Morning-weighted hour distribution (cafe traffic pattern) ────────────────
const CAFE_HOURS = [
    7,  7,  8,  8,  8,  8,  9,  9,  9,  9,
    10, 10, 10, 11, 11, 12, 12, 12, 13, 13,
    14, 15, 15, 16, 16, 17, 17, 18, 18, 19,
];

// ─── Cafe Audit log actions ───────────────────────────────────────────────────
const AUDIT_ACTIONS = [
    { action: 'DEPOSIT_CREATED',         details: { depositId: 1, customerId: 4,  amount: 30.00 } },
    { action: 'DEPOSIT_APPROVED',        details: { depositId: 1, walletId: 1,    amount: 30.00 } },
    { action: 'DEPOSIT_CREATED',         details: { depositId: 2, customerId: 5,  amount: 50.00 } },
    { action: 'DEPOSIT_APPROVED',        details: { depositId: 2, walletId: 2,    amount: 50.00 } },
    { action: 'DEPOSIT_REJECTED',        details: { depositId: 3, walletId: 3,    amount: 20.00, note: 'Unverified reference' } },
    { action: 'PAYMENT_MARKED_SUCCESS',  details: { paymentId: 1, method: 'cash', amount: 5.50,  orderId: 1 } },
    { action: 'PAYMENT_MARKED_SUCCESS',  details: { paymentId: 2, method: 'qr',   amount: 8.00,  orderId: 2 } },
    { action: 'PAYMENT_MARKED_FAILED',   details: { paymentId: 3, orderId: 5,     amount: 6.50 } },
    { action: 'STOCK_ADJUSTMENT',        details: { movementId: 1, ingredientId: 2, ingredientName: 'Fresh Milk', type: 'in', quantity: 5000, newStock: 25000 } },
    { action: 'STOCK_ADJUSTMENT',        details: { movementId: 2, ingredientId: 9, ingredientName: 'Matcha Powder', type: 'in', quantity: 500, newStock: 1500 } },
    { action: 'USER_ROLE_CHANGED',       details: { targetUserId: 3, previousRoleIds: [2], addedRoleIds: [] } },
];

// ─── Seeder ───────────────────────────────────────────────────────────────────

export class CafeOrderSeeder {

    private static products: Product[] = [];
    private static productMap: Map<number, Product> = new Map();

    public static async seed(): Promise<void> {
        try {
            CafeOrderSeeder.products = await Product.findAll();
            CafeOrderSeeder.products.forEach(p => CafeOrderSeeder.productMap.set(p.id, p));

            await CafeOrderSeeder._seedWallets();
            await CafeOrderSeeder._seedOrders();
            await CafeOrderSeeder._seedRewards();
            await CafeOrderSeeder._seedAuditLogs();
        } catch (err) {
            console.error('\x1b[31mError in CafeOrderSeeder:', err.message);
            throw err;
        }
    }

    // ── Wallets & deposit history ─────────────────────────────────────────────
    private static async _seedWallets(): Promise<void> {
        const walletRows = CUSTOMER_IDS.map(cid => ({
            customer_id: cid,
            balance    : 0,     // will be updated as we insert approved deposits
        }));
        await Wallet.bulkCreate(walletRows);

        const wallets = await Wallet.findAll();
        const walletMap = new Map(wallets.map(w => [w.customer_id, w]));

        // Deposit requests + approvals per customer
        const depositPlans: { cid: number; amount: number; approved: boolean; daysBack: number }[] = [
            { cid: 4, amount: 30.00, approved: true,  daysBack: 60 },
            { cid: 4, amount: 20.00, approved: true,  daysBack: 30 },
            { cid: 4, amount: 10.00, approved: false, daysBack: 5  }, // pending
            { cid: 5, amount: 50.00, approved: true,  daysBack: 55 },
            { cid: 5, amount: 25.00, approved: true,  daysBack: 20 },
            { cid: 6, amount: 40.00, approved: true,  daysBack: 45 },
            { cid: 6, amount: 15.00, approved: false, daysBack: 2  }, // rejected
            { cid: 7, amount: 60.00, approved: true,  daysBack: 70 },
            { cid: 7, amount: 30.00, approved: true,  daysBack: 35 },
            { cid: 8, amount: 25.00, approved: true,  daysBack: 50 },
        ];

        const txRows = depositPlans.map((d, i) => ({
            wallet_id   : walletMap.get(d.cid)!.id,
            type        : WalletTransactionType.DEPOSIT,
            amount      : d.amount,
            status      : d.approved ? DepositStatus.APPROVED : DepositStatus.PENDING,
            reference   : `DEP-${2026}-${String(i + 1).padStart(4, '0')}`,
            note        : d.approved ? 'Bank transfer – verified' : 'Pending verification',
            processed_by: d.approved ? ADMIN_ID : null,
            created_at  : daysAgo(d.daysBack),
        }));
        await WalletTransaction.bulkCreate(txRows);

        // Credit approved deposits into wallet balance
        for (const d of depositPlans) {
            if (d.approved) {
                const w = walletMap.get(d.cid)!;
                await Wallet.increment('balance', { by: d.amount, where: { id: w.id } });
            }
        }

        console.log('\x1b[32m✔  Wallets & deposits seeded');
    }

    // ── Orders (90 days, realistic distribution) ──────────────────────────────
    private static async _seedOrders(): Promise<void> {
        const ordersToCreate = 200;

        for (let i = 0; i < ordersToCreate; i++) {
            const daysBack  = randInt(0, 89);
            const hour      = CAFE_HOURS[randInt(0, CAFE_HOURS.length - 1)];
            const orderedAt = daysAgoHour(daysBack, hour);

            // Channel mix: 60% walk-in, 20% website, 20% telegram
            const channelRoll = randInt(1, 100);
            let channel: OrderChannelEnum;
            let cashier_id: number | null  = null;
            let customer_id: number | null = null;

            if (channelRoll <= 60) {
                channel    = OrderChannelEnum.WALK_IN;
                cashier_id = pick(CASHIER_IDS);
            } else if (channelRoll <= 80) {
                channel     = OrderChannelEnum.WEBSITE;
                customer_id = pick(CUSTOMER_IDS);
            } else {
                channel     = OrderChannelEnum.TELEGRAM;
                customer_id = pick(CUSTOMER_IDS);
            }

            // Status mix: 75% completed, 5% cancelled, 10% preparing, 10% pending
            const statusRoll = randInt(1, 100);
            let status: OrderStatusEnum;
            if      (statusRoll <= 75) status = OrderStatusEnum.COMPLETED;
            else if (statusRoll <= 80) status = OrderStatusEnum.CANCELLED;
            else if (statusRoll <= 90) status = OrderStatusEnum.PREPARING;
            else                       status = OrderStatusEnum.PENDING;

            const receiptNumber = await CafeOrderSeeder._uniqueReceipt();

            const order = await Order.create({
                receipt_number: receiptNumber,
                cashier_id,
                customer_id,
                channel,
                status,
                total_price: 0,
                ordered_at : orderedAt,
            });

            // ── Order details ──────────────────────────────────────────────
            const lineCount = randInt(1, 4);
            let totalPrice  = 0;
            const detailRows: object[] = [];

            for (let l = 0; l < lineCount; l++) {
                const productId = CafeOrderSeeder._weightedProduct();
                const product   = CafeOrderSeeder.productMap.get(productId);
                if (!product) continue;
                const qty = randInt(1, 3);
                detailRows.push({ order_id: order.id, product_id: product.id, unit_price: product.unit_price, qty });
                totalPrice += product.unit_price * qty;
            }

            await OrderDetails.bulkCreate(detailRows);
            await order.update({ total_price: +totalPrice.toFixed(2) });

            // ── Payment transaction for COMPLETED orders ───────────────────
            if (status === OrderStatusEnum.COMPLETED) {
                const methodRoll = randInt(1, 100);
                let method: PaymentMethod;
                if      (methodRoll <= 60) method = PaymentMethod.CASH;
                else if (methodRoll <= 75) method = PaymentMethod.CARD;
                else if (methodRoll <= 90) method = PaymentMethod.QR;
                else                       method = PaymentMethod.WALLET;

                await PaymentTransaction.create({
                    order_id    : order.id,
                    customer_id : customer_id ?? null,
                    method,
                    status      : PaymentStatus.SUCCESS,
                    amount      : +totalPrice.toFixed(2),
                    paid_at     : orderedAt,
                    processed_by: cashier_id ?? ADMIN_ID,
                    note        : method === PaymentMethod.CASH ? 'Cash received at counter' : null,
                    created_at  : orderedAt,
                });

                // Deduct wallet balance for WALLET payments
                if (method === PaymentMethod.WALLET && customer_id) {
                    const wallet = await Wallet.findOne({ where: { customer_id } });
                    if (wallet && Number(wallet.balance) >= totalPrice) {
                        await Wallet.decrement('balance', { by: totalPrice, where: { id: wallet.id } });
                        await WalletTransaction.create({
                            wallet_id   : wallet.id,
                            type        : WalletTransactionType.PAYMENT,
                            amount      : +totalPrice.toFixed(2),
                            status      : DepositStatus.APPROVED,
                            reference   : receiptNumber,
                            note        : `Payment for order #${receiptNumber}`,
                            processed_by: ADMIN_ID,
                            created_at  : orderedAt,
                        });
                    }
                }
            }

            // ── Notification for walk-in orders ────────────────────────────
            if (channel === OrderChannelEnum.WALK_IN && cashier_id) {
                await Notifications.create({
                    order_id: order.id,
                    user_id : cashier_id,
                    read    : status === OrderStatusEnum.COMPLETED,
                });
            }
        }

        console.log('\x1b[32m✔  Orders + details + payments + notifications seeded (%d orders)', ordersToCreate);
    }

    // ── Reward points per customer ─────────────────────────────────────────────
    private static async _seedRewards(): Promise<void> {
        const plans: { cid: number; balance: number; earn: { pts: number; ref: string; daysBack: number }[]; redeem?: { pts: number; daysBack: number } }[] = [
            {
                cid: 4, balance: 120,
                earn : [
                    { pts: 60,  ref: 'ORD-001', daysBack: 60 },
                    { pts: 80,  ref: 'ORD-002', daysBack: 40 },
                    { pts: 50,  ref: 'ORD-003', daysBack: 20 },
                ],
                redeem: { pts: 70, daysBack: 15 },
            },
            {
                cid: 5, balance: 200,
                earn : [
                    { pts: 100, ref: 'ORD-010', daysBack: 55 },
                    { pts: 120, ref: 'ORD-011', daysBack: 30 },
                    { pts: 80,  ref: 'ORD-012', daysBack: 10 },
                ],
                redeem: { pts: 100, daysBack: 8 },
            },
            {
                cid: 6, balance: 85,
                earn : [
                    { pts: 50,  ref: 'ORD-020', daysBack: 45 },
                    { pts: 60,  ref: 'ORD-021', daysBack: 20 },
                    { pts: 25,  ref: 'ORD-022', daysBack: 5  },
                ],
                redeem: { pts: 50, daysBack: 3 },
            },
            {
                cid: 7, balance: 310,
                earn : [
                    { pts: 150, ref: 'ORD-030', daysBack: 70 },
                    { pts: 200, ref: 'ORD-031', daysBack: 45 },
                    { pts: 60,  ref: 'ORD-032', daysBack: 10 },
                ],
                redeem: { pts: 100, daysBack: 7 },
            },
            {
                cid: 8, balance: 75,
                earn : [
                    { pts: 40,  ref: 'ORD-040', daysBack: 50 },
                    { pts: 55,  ref: 'ORD-041', daysBack: 25 },
                    { pts: 30,  ref: 'ORD-042', daysBack: 8  },
                ],
                redeem: { pts: 50, daysBack: 5 },
            },
        ];

        const oneYear = new Date();
        oneYear.setFullYear(oneYear.getFullYear() + 1);

        for (const plan of plans) {
            const rp = await RewardPoint.create({
                customer_id: plan.cid,
                balance    : plan.balance,
                created_at : daysAgo(90),
            });

            const txRows: object[] = plan.earn.map(e => ({
                reward_point_id: rp.id,
                customer_id    : plan.cid,
                type           : RewardTransactionType.EARN,
                points         : e.pts,
                reference      : e.ref,
                note           : 'Points earned from purchase',
                expires_at     : oneYear,
                created_at     : daysAgo(e.daysBack),
            }));

            if (plan.redeem) {
                txRows.push({
                    reward_point_id: rp.id,
                    customer_id    : plan.cid,
                    type           : RewardTransactionType.REDEEM,
                    points         : plan.redeem.pts,
                    reference      : null,
                    note           : 'Points redeemed for discount',
                    expires_at     : null,
                    created_at     : daysAgo(plan.redeem.daysBack),
                });
            }

            await RewardTransaction.bulkCreate(txRows);
        }

        console.log('\x1b[32m✔  Reward points & transactions seeded');
    }

    // ── Audit log entries (sample history) ────────────────────────────────────
    private static async _seedAuditLogs(): Promise<void> {
        const rows = AUDIT_ACTIONS.map(a => ({
            user_id   : ADMIN_ID,
            action    : a.action,
            details   : JSON.stringify(a.details),
            ip_address: '127.0.0.1',
            browser   : 'Chrome 124',
            os        : 'macOS 15',
            platform  : 'Web',
            created_at: daysAgo(randInt(1, 30)),
        }));
        await UsersLogs.bulkCreate(rows);
        console.log('\x1b[32m✔  Audit logs seeded (%d entries)', rows.length);
    }

    // ── Receipt number generator ──────────────────────────────────────────────
    private static _usedReceipts = new Set<string>();

    private static async _uniqueReceipt(): Promise<string> {
        let num: string;
        do {
            num = String(randInt(1000000, 9999999));
        } while (CafeOrderSeeder._usedReceipts.has(num));
        CafeOrderSeeder._usedReceipts.add(num);
        return num;
    }

    // ── Weighted random product pick ──────────────────────────────────────────
    private static _weightedProduct(): number {
        let roll = randInt(1, TOTAL_WEIGHT);
        for (const [id, weight] of POPULAR_PRODUCTS) {
            roll -= weight;
            if (roll <= 0) return id;
        }
        return POPULAR_PRODUCTS[0][0];
    }
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

function randInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
    return arr[randInt(0, arr.length - 1)];
}

function daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

function daysAgoHour(n: number, hour: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(hour, randInt(0, 59), randInt(0, 59), 0);
    return d;
}
