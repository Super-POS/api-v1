import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import CoffeeRankTier from '@app/models/setting/coffee_rank_tier.model';
import CoffeeRankTierReward, { RankRewardType } from '@app/models/setting/coffee_rank_tier_reward.model';
import Menu from '@app/models/menu/menu.model';
import { CreateRankRewardDto, UpdateRankRewardDto } from './dto';

@Injectable()
export class AdminRankRewardService {

    async list(tierId: number): Promise<CoffeeRankTierReward[]> {
        await this._assertTierExists(tierId);
        return CoffeeRankTierReward.findAll({
            where  : { tier_id: tierId },
            include: [{ model: Menu, as: 'menu', attributes: ['id', 'name', 'code', 'image'] }],
            order  : [['id', 'ASC']],
        });
    }

    async create(tierId: number, body: CreateRankRewardDto): Promise<CoffeeRankTierReward> {
        await this._assertTierExists(tierId);
        this._validate(body.type, body);

        const row = await CoffeeRankTierReward.create({
            tier_id                : tierId,
            type                   : body.type,
            label                  : body.label.trim(),
            description            : body.description?.trim() ?? null,
            coupon_discount_percent: body.type === RankRewardType.COUPON ? (body.coupon_discount_percent ?? null) : null,
            coupon_expires_days    : body.type === RankRewardType.COUPON ? (body.coupon_expires_days ?? null) : null,
            menu_id                : body.type === RankRewardType.ITEM ? (body.menu_id ?? null) : null,
            quantity               : body.type === RankRewardType.ITEM ? (body.quantity ?? 1) : 1,
            is_active              : body.is_active !== false,
        } as any);

        return row.reload({ include: [{ model: Menu, as: 'menu', attributes: ['id', 'name', 'code', 'image'] }] });
    }

    async update(tierId: number, rewardId: number, body: UpdateRankRewardDto): Promise<CoffeeRankTierReward> {
        const row = await CoffeeRankTierReward.findOne({ where: { id: rewardId, tier_id: tierId } });
        if (!row) throw new NotFoundException(`Reward #${rewardId} not found in tier #${tierId}.`);

        const patch: Partial<any> = {};
        if (body.label              != null) patch.label                   = body.label.trim();
        if (body.description        !== undefined) patch.description       = body.description?.trim() ?? null;
        if (body.coupon_discount_percent != null) patch.coupon_discount_percent = body.coupon_discount_percent;
        if (body.coupon_expires_days !== undefined) patch.coupon_expires_days = body.coupon_expires_days ?? null;
        if (body.menu_id            !== undefined) patch.menu_id           = body.menu_id ?? null;
        if (body.quantity           != null) patch.quantity                = body.quantity;
        if (body.is_active          !== undefined) patch.is_active         = body.is_active;

        await row.update(patch);
        return row.reload({ include: [{ model: Menu, as: 'menu', attributes: ['id', 'name', 'code', 'image'] }] });
    }

    async remove(tierId: number, rewardId: number): Promise<void> {
        const n = await CoffeeRankTierReward.destroy({ where: { id: rewardId, tier_id: tierId } });
        if (n === 0) throw new NotFoundException(`Reward #${rewardId} not found in tier #${tierId}.`);
    }

    private async _assertTierExists(tierId: number): Promise<void> {
        const tier = await CoffeeRankTier.findByPk(tierId);
        if (!tier) throw new NotFoundException(`Rank tier #${tierId} not found.`);
    }

    private _validate(type: RankRewardType, body: CreateRankRewardDto): void {
        if (type === RankRewardType.COUPON) {
            if (!body.coupon_discount_percent) {
                throw new BadRequestException('coupon_discount_percent is required for coupon rewards.');
            }
        } else if (type === RankRewardType.ITEM) {
            if (!body.menu_id) {
                throw new BadRequestException('menu_id is required for item rewards.');
            }
        }
    }
}
