// ===========================================================================>> Core Library
import { Injectable } from '@nestjs/common';

// ===========================================================================>> Third Party Library
import { literal, Op } from 'sequelize';

// ===========================================================================>> Custom Library
import Order            from '@app/models/order/order.model';
import OrderDetails     from '@app/models/order/detail.model';
import Menu          from '@app/models/menu/menu.model';
import MenuType      from '@app/models/menu/menu-type.model';
import RewardPoint      from '@app/models/reward/reward_point.model';
import User             from '@app/models/user/user.model';
import Wallet           from '@app/models/wallet/wallet.model';
import { RewardEngineService } from '@app/services/reward-engine.service';

@Injectable()
export class CustomerProfileService {

    constructor(private readonly _engine: RewardEngineService) {}

    async getProfile(customer_id: number): Promise<any> {

        // ── 1. Basic user info ──────────────────────────────────────────────
        const user = await User.findByPk(customer_id, {
            attributes: ['id', 'name', 'avatar', 'phone', 'email', 'created_at'],
        });

        // ── 2. Wallet balance ───────────────────────────────────────────────
        const wallet = await Wallet.findOne({ where: { customer_id } });
        const wallet_balance = wallet ? Number(wallet.balance) : 0;

        // ── 3. Reward points (expire stale first) ───────────────────────────
        await this._engine.expireForCustomer(customer_id);
        const rewardPoint    = await RewardPoint.findOne({ where: { customer_id } });
        const reward_balance = rewardPoint ? Number(rewardPoint.balance) : 0;

        // ── 4. Order summary stats ──────────────────────────────────────────
        const orderStats = await Order.findOne({
            attributes: [
                [literal('COUNT(*)'),                       'total_orders'],
                [literal('COALESCE(SUM(total_price), 0)'),  'total_spent'],
                [literal(`COUNT(*) FILTER (WHERE status = 'pending')`),    'pending_orders'],
                [literal(`COUNT(*) FILTER (WHERE status = 'completed')`),  'completed_orders'],
            ],
            where: { customer_id },
            raw: true,
        }) as any;

        // ── 5. Last 5 orders ────────────────────────────────────────────────
        const recent_orders = await Order.findAll({
            attributes: ['id', 'receipt_number', 'total_price', 'channel', 'status', 'ordered_at'],
            where     : { customer_id },
            include   : [
                {
                    model     : OrderDetails,
                    attributes: ['id', 'unit_price', 'qty'],
                    include   : [
                        {
                            model     : Menu,
                            attributes: ['id', 'name', 'code', 'image'],
                            include   : [{ model: MenuType, attributes: ['name'] }],
                        },
                    ],
                },
            ],
            order: [['ordered_at', 'DESC']],
            limit: 5,
        });

        return {
            data: {
                user,
                wallet: {
                    balance: wallet_balance,
                },
                rewards: {
                    balance       : reward_balance,
                    discount_value: this._engine.pointsToDiscount(reward_balance),
                },
                stats: {
                    total_orders     : Number(orderStats?.total_orders     ?? 0),
                    total_spent      : Number(orderStats?.total_spent      ?? 0),
                    pending_orders   : Number(orderStats?.pending_orders   ?? 0),
                    completed_orders : Number(orderStats?.completed_orders ?? 0),
                },
                recent_orders,
            },
        };
    }
}
