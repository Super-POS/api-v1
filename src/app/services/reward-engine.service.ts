// ===========================================================================>> Core Library
import { BadRequestException, Injectable } from '@nestjs/common';

// ===========================================================================>> Custom Library
import RewardPoint                        from '@app/models/reward/reward_point.model';
import RewardTransaction, { RewardTransactionType } from '@app/models/reward/reward_transaction.model';
import { COFFEE_RANKS }                   from '@app/services/badge-ai.service';

// 1 point earned per this many currency units spent
const POINTS_PER_UNIT = 1;

// Points value: 100 points = 1 currency unit
const REDEMPTION_RATE = 100;

// Points expire after this many days from earn date
const EXPIRY_DAYS = 365;

export interface EarnResult {
    transaction  : RewardTransaction | null;
    rankedUp     : boolean;
    prevTier     : number;
    newTier      : number;
    newRankLabel : string;
    badgeAnswers : string | null;   // stored Q&A for auto-badge reassignment
    rewardPointId: number;
}

function tierFromTotal(total: number): { tier: number; label: string } {
    let current = COFFEE_RANKS[0];
    for (const r of COFFEE_RANKS) {
        if (total >= r.min) current = r;
        else break;
    }
    return { tier: current.tier, label: current.label };
}

@Injectable()
export class RewardEngineService {

    // ===================================================>> Earn points after a successful purchase
    async earn(customer_id: number, amount: number, reference?: string): Promise<EarnResult> {
        const points = Math.floor(amount / POINTS_PER_UNIT);
        if (points <= 0) {
            const rp = await RewardPoint.findOne({ where: { customer_id } });
            return { transaction: null, rankedUp: false, prevTier: rp?.rank_tier ?? 1, newTier: rp?.rank_tier ?? 1, newRankLabel: COFFEE_RANKS[0].label, badgeAnswers: null, rewardPointId: rp?.id ?? 0 };
        }

        const [rewardPoint] = await RewardPoint.findOrCreate({
            where   : { customer_id },
            defaults: { customer_id, balance: 0, rank_tier: 1 },
        });

        const prevTier = rewardPoint.rank_tier ?? 1;

        await RewardPoint.increment('balance', { by: points, where: { id: rewardPoint.id } });

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS);

        const transaction = await RewardTransaction.create({
            reward_point_id: rewardPoint.id,
            customer_id,
            type      : RewardTransactionType.EARN,
            points,
            reference : reference ?? null,
            note      : `Earned ${points} pts from purchase`,
            expires_at: expiresAt,
        });

        // Compute new total earned to resolve rank
        const totalResult = await RewardTransaction.findOne({
            where     : { customer_id, type: RewardTransactionType.EARN },
            attributes: [[RewardTransaction.sequelize!.fn('SUM', RewardTransaction.sequelize!.col('points')), 'total']],
            raw       : true,
        }) as any;
        const totalEarned = Number(totalResult?.total ?? points);
        const { tier: newTier, label: newRankLabel } = tierFromTotal(totalEarned);

        const rankedUp = newTier > prevTier;
        if (rankedUp) {
            await RewardPoint.update({ rank_tier: newTier }, { where: { id: rewardPoint.id } });
        }

        return {
            transaction,
            rankedUp,
            prevTier,
            newTier,
            newRankLabel,
            badgeAnswers : rewardPoint.badge_answers ?? null,
            rewardPointId: rewardPoint.id,
        };
    }

    // ===================================================>> Redeem points, returns monetary discount value
    async redeem(customer_id: number, points: number, reference?: string): Promise<number> {
        if (points <= 0) throw new BadRequestException('Points to redeem must be greater than 0.');

        await this._expireOldPoints(customer_id);

        const rewardPoint = await RewardPoint.findOne({ where: { customer_id } });
        if (!rewardPoint || rewardPoint.balance < points) {
            throw new BadRequestException('Insufficient reward points.');
        }

        await RewardPoint.decrement('balance', { by: points, where: { id: rewardPoint.id } });

        await RewardTransaction.create({
            reward_point_id: rewardPoint.id,
            customer_id,
            type      : RewardTransactionType.REDEEM,
            points,
            reference : reference ?? null,
            note      : `Redeemed ${points} pts`,
        });

        // Return the monetary discount value
        return points / REDEMPTION_RATE;
    }

    // ===================================================>> Expire stale points for a customer
    async expireForCustomer(customer_id: number): Promise<void> {
        await this._expireOldPoints(customer_id);
    }

    // ===================================================>> Get current balance
    async getBalance(customer_id: number): Promise<number> {
        await this._expireOldPoints(customer_id);
        const rp = await RewardPoint.findOne({ where: { customer_id } });
        return rp ? Number(rp.balance) : 0;
    }

    // ===================================================>> Conversion helper exposed for controllers
    pointsToDiscount(points: number): number {
        return points / REDEMPTION_RATE;
    }

    // ===================================================>> Internal: expire points past their expiry date
    private async _expireOldPoints(customer_id: number): Promise<void> {
        const rewardPoint = await RewardPoint.findOne({ where: { customer_id } });
        if (!rewardPoint) return;

        const expired = await RewardTransaction.findAll({
            where: {
                customer_id,
                type: RewardTransactionType.EARN,
            },
        });

        const now = new Date();
        let totalExpired = 0;

        for (const tx of expired) {
            if (tx.expires_at && tx.expires_at < now) {
                // Mark as expired by creating an EXPIRE transaction
                await RewardTransaction.create({
                    reward_point_id: rewardPoint.id,
                    customer_id,
                    type     : RewardTransactionType.EXPIRE,
                    points   : tx.points,
                    reference: tx.reference,
                    note     : `Points expired (original earn on ${tx.created_at?.toISOString().split('T')[0]})`,
                });
                totalExpired += tx.points;

                // Clear expires_at so this earn row isn't re-processed
                await tx.update({ expires_at: null });
            }
        }

        if (totalExpired > 0) {
            const newBalance = Math.max(0, Number(rewardPoint.balance) - totalExpired);
            await RewardPoint.update({ balance: newBalance }, { where: { id: rewardPoint.id } });
        }
    }
}
