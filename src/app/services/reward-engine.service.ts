// ===========================================================================>> Core Library
import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';

// ===========================================================================>> Custom Library
import RewardPoint                        from '@app/models/reward/reward_point.model';
import RewardTransaction, { RewardTransactionType } from '@app/models/reward/reward_transaction.model';
import CoffeeRankTierReward, { RankRewardType } from '@app/models/setting/coffee_rank_tier_reward.model';
import UserRankReward                     from '@app/models/setting/user_rank_reward.model';
import Coupon                             from '@app/models/coupon/coupon.model';
import CouponAssignedUser                 from '@app/models/coupon/coupon_assigned_user.model';
import { CoffeeRankTierService }          from '@app/services/coffee-rank-tier.service';

const REWARD_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// 1 point earned per this many currency units spent
const POINTS_PER_UNIT = 1;

// Points value: 100 points = 1 currency unit
const REDEMPTION_RATE = 100;

// Points expire after this many days from earn date
const EXPIRY_DAYS = 365;

export interface EarnResult {
    transaction   : RewardTransaction | null;
    rankedUp      : boolean;
    prevTier      : number;
    newTier       : number;
    newRankLabel  : string;
    badgeAnswers  : string | null;
    rewardPointId : number;
    issuedRewards : UserRankReward[];
}

@Injectable()
export class RewardEngineService {

    constructor(private readonly _rankTierService: CoffeeRankTierService) {}

    // ===================================================>> Earn points after a successful purchase
    async earn(customer_id: number, amount: number, reference?: string): Promise<EarnResult> {
        const points = Math.floor(amount / POINTS_PER_UNIT);
        if (points <= 0) {
            const rp = await RewardPoint.findOne({ where: { customer_id } });
            const { tier, label } = await this._rankTierService.tierFromTotal(rp?.rank_tier ?? 0);
            return { transaction: null, rankedUp: false, prevTier: rp?.rank_tier ?? 1, newTier: tier, newRankLabel: label, badgeAnswers: null, rewardPointId: rp?.id ?? 0, issuedRewards: [] };
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
        const { tier: newTier, label: newRankLabel } = await this._rankTierService.tierFromTotal(totalEarned);

        const rankedUp = newTier > prevTier;
        let issuedRewards: UserRankReward[] = [];

        if (rankedUp) {
            await RewardPoint.update({ rank_tier: newTier }, { where: { id: rewardPoint.id } });
            issuedRewards = await this._issueRankRewards(customer_id, newTier);
        }

        return {
            transaction,
            rankedUp,
            prevTier,
            newTier,
            newRankLabel,
            badgeAnswers : rewardPoint.badge_answers ?? null,
            rewardPointId: rewardPoint.id,
            issuedRewards,
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

    // ===================================================>> Internal: issue active rewards for a newly reached tier
    private async _issueRankRewards(customer_id: number, newTier: number): Promise<UserRankReward[]> {
        const tierId = await this._rankTierService.tierIdFromTierNumber(newTier);
        if (!tierId) return [];

        const rewards = await CoffeeRankTierReward.findAll({ where: { tier_id: tierId, is_active: true } });
        if (!rewards.length) return [];

        const issued: UserRankReward[] = [];

        for (const reward of rewards) {
            if (reward.type === RankRewardType.COUPON) {
                const code = await this._generateRewardCouponCode();
                const expiresAt = reward.coupon_expires_days
                    ? new Date(Date.now() + reward.coupon_expires_days * 86_400_000)
                    : null;

                const coupon = await Coupon.create({
                    code,
                    discount_percent: Number(reward.coupon_discount_percent),
                    is_active       : true,
                    note            : `Rank reward: ${reward.label}`,
                    usage_limit     : 1,
                    expires_at      : expiresAt,
                } as any);

                await CouponAssignedUser.create({ coupon_id: coupon.id, user_id: customer_id } as any);

                const entry = await UserRankReward.create({
                    customer_id,
                    tier_id         : tierId,
                    reward_id       : reward.id,
                    status          : 'pending',
                    issued_coupon_id: coupon.id,
                    expires_at      : expiresAt,
                } as any);
                issued.push(entry);

            } else if (reward.type === RankRewardType.ITEM) {
                const entry = await UserRankReward.create({
                    customer_id,
                    tier_id  : tierId,
                    reward_id: reward.id,
                    status   : 'pending',
                } as any);
                issued.push(entry);
            }
        }

        return issued;
    }

    private async _generateRewardCouponCode(maxAttempts = 24): Promise<string> {
        for (let i = 0; i < maxAttempts; i++) {
            const buf = randomBytes(10);
            let code = '';
            for (let j = 0; j < 10; j++) {
                code += REWARD_CODE_ALPHABET[buf[j] % REWARD_CODE_ALPHABET.length];
            }
            const exists = await Coupon.findOne({ where: { code } });
            if (!exists) return code;
        }
        throw new BadRequestException('Could not generate a unique coupon code for rank reward.');
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
