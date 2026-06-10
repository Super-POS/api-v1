// ===========================================================================>> Core Library
import { Injectable } from '@nestjs/common';

// ===========================================================================>> Third Party Library
import { Op } from 'sequelize';

// ===========================================================================>> Custom Library
import RewardPoint                        from '@app/models/reward/reward_point.model';
import RewardTransaction, { RewardTransactionType } from '@app/models/reward/reward_transaction.model';
import UserRankReward, { UserRankRewardStatus } from '@app/models/setting/user_rank_reward.model';
import CoffeeRankTierReward               from '@app/models/setting/coffee_rank_tier_reward.model';
import CoffeeRankTier                     from '@app/models/setting/coffee_rank_tier.model';
import Coupon                             from '@app/models/coupon/coupon.model';
import Menu                               from '@app/models/menu/menu.model';
import { RewardEngineService }            from '@app/services/reward-engine.service';
import { BadgeAiService, BADGE_QUESTIONS } from '@app/services/badge-ai.service';
import { CoffeeRankTierService }           from '@app/services/coffee-rank-tier.service';
import { AssignBadgeDto, RedeemRewardDto } from './dto';
import User from '@app/models/user/user.model';
import { NotFoundException } from '@nestjs/common';

@Injectable()
export class CustomerRewardService {

    constructor(
        private readonly _engine    : RewardEngineService,
        private readonly _badgeAi   : BadgeAiService,
        private readonly _rankTierService: CoffeeRankTierService,
    ) {}

    // ==========================================>> Customer reward profile (balance + history)
    async getProfile(customer_id: number): Promise<any> {
        await this._engine.expireForCustomer(customer_id);

        const [rewardPoint] = await RewardPoint.findOrCreate({
            where   : { customer_id },
            defaults: { customer_id, balance: 0 },
        });

        const transactions = await RewardTransaction.findAll({
            where : { customer_id },
            order : [['created_at', 'DESC']],
            limit : 30,
        });

        const totalEarned = await this._totalEarned(customer_id);
        const rank = await this._rankTierService.resolveRank(totalEarned);

        return {
            data: {
                balance        : Number(rewardPoint.balance),
                discount_value : this._engine.pointsToDiscount(rewardPoint.balance),
                badge          : rewardPoint.badge ? { name: rewardPoint.badge } : null,
                rank,
                total_earned   : totalEarned,
                history        : transactions,
            },
        };
    }

    // ==========================================>> Preview redemption value before checkout
    async previewRedeem(points: number): Promise<any> {
        return {
            data: {
                points,
                discount_value: this._engine.pointsToDiscount(points),
            },
        };
    }

    // ==========================================>> Redeem points at checkout
    async redeem(customer_id: number, body: RedeemRewardDto): Promise<any> {
        const discount = await this._engine.redeem(customer_id, body.points, body.reference);

        return {
            data: {
                points_redeemed: body.points,
                discount_value : discount,
            },
            message: `${body.points} points redeemed for a ${discount.toFixed(2)} currency unit discount.`,
        };
    }

    // ==========================================>> All rank tiers (for journey display)
    async getTiers(): Promise<any> {
        const tiers = await this._rankTierService.findAll();
        return {
            data: tiers.map(t => ({
                tier       : t.tier,
                label      : t.label,
                min_points : t.min_points,
                icon       : (t as any).icon ?? null,
            })),
        };
    }

    // ==========================================>> Current rank
    async getRank(customer_id: number): Promise<any> {
        const totalEarned = await this._totalEarned(customer_id);
        const rank = await this._rankTierService.resolveRank(totalEarned);
        return { data: { total_earned: totalEarned, rank } };
    }

    // ==========================================>> Badge questions
    getBadgeQuestions(): any {
        return { data: BADGE_QUESTIONS };
    }

    // ==========================================>> AI-assign badge
    async assignBadge(customer_id: number, body: AssignBadgeDto): Promise<any> {
        const rewardPoint = await RewardPoint.findOne({ where: { customer_id } });
        const totalEarned = await this._totalEarned(customer_id);
        const rank = await this._rankTierService.resolveRank(totalEarned);

        const customer = await User.findByPk(customer_id, { attributes: ['id', 'name'] });
        const customerName = customer?.name ?? 'Customer';

        const badge = await this._badgeAi.decideBadge({
            customerName,
            totalEarned,
            rankLabel: rank.name,
            answers  : body.answers,
        });

        // Persist the badge and questionnaire answers
        const answersJson = JSON.stringify(body.answers);
        if (rewardPoint) {
            await rewardPoint.update({ badge, badge_answers: answersJson });
        } else {
            await RewardPoint.create({ customer_id, balance: 0, badge, badge_answers: answersJson } as any);
        }

        return {
            data   : { badge: { name: badge }, rank },
            message: `Your badge "${badge}" has been assigned!`,
        };
    }

    // ==========================================>> My rank rewards (pending/claimed/expired)
    async getMyRewards(customer_id: number): Promise<any> {
        const rows = await UserRankReward.findAll({
            where  : { customer_id },
            order  : [['created_at', 'DESC']],
            include: [
                {
                    model  : CoffeeRankTierReward,
                    as     : 'reward',
                    include: [{ model: Menu, as: 'menu', attributes: ['id', 'name', 'code', 'image'] }],
                },
                { model: CoffeeRankTier, as: 'tier', attributes: ['id', 'tier', 'label', 'icon'] },
                { model: Coupon, as: 'issued_coupon', attributes: ['id', 'code', 'discount_percent', 'expires_at', 'is_active'] },
            ],
        });

        return { data: rows };
    }

    // ==========================================>> Claim a pending item reward
    async claimItemReward(customer_id: number, userRewardId: number): Promise<any> {
        const row = await UserRankReward.findOne({
            where  : { id: userRewardId, customer_id },
            include: [{ model: CoffeeRankTierReward, as: 'reward' }],
        });

        if (!row) throw new NotFoundException('Reward not found.');
        if (row.status !== UserRankRewardStatus.PENDING) {
            throw new NotFoundException(`Reward is already ${row.status}.`);
        }

        await row.update({ status: UserRankRewardStatus.CLAIMED, claimed_at: new Date() });
        return { data: row, message: 'Reward claimed successfully.' };
    }

    // ==========================================>> Internal: sum all earn transactions
    private async _totalEarned(customer_id: number): Promise<number> {
        const result = await RewardTransaction.findOne({
            where     : { customer_id, type: RewardTransactionType.EARN },
            attributes: [[RewardTransaction.sequelize!.fn('SUM', RewardTransaction.sequelize!.col('points')), 'total']],
            raw       : true,
        }) as any;
        return Number(result?.total ?? 0);
    }
}
