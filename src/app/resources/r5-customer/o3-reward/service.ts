// ===========================================================================>> Core Library
import { Injectable } from '@nestjs/common';

// ===========================================================================>> Custom Library
import RewardPoint       from '@app/models/reward/reward_point.model';
import RewardTransaction from '@app/models/reward/reward_transaction.model';
import { RewardEngineService } from '@app/services/reward-engine.service';
import { RedeemRewardDto } from './dto';

@Injectable()
export class CustomerRewardService {

    constructor(private readonly _engine: RewardEngineService) {}

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

        return {
            data: {
                balance         : Number(rewardPoint.balance),
                discount_value  : this._engine.pointsToDiscount(rewardPoint.balance),
                transactions,
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
            message: `${body.points} points redeemed for a $${discount.toFixed(2)} discount.`,
        };
    }
}
