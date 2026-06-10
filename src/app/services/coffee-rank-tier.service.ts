import { Injectable, NotFoundException } from '@nestjs/common';
import CoffeeRankTier from '@app/models/setting/coffee_rank_tier.model';

export interface RankInfo {
    level          : number;
    name           : string;
    min_points     : number;
    max_points     : number | null;
    next_rank_name : string | null;
    points_to_next : number | null;
}

@Injectable()
export class CoffeeRankTierService {

    async findAll(): Promise<CoffeeRankTier[]> {
        return CoffeeRankTier.findAll({ order: [['tier', 'ASC']] });
    }

    async update(id: number, data: { label?: string; min_points?: number; icon?: string }): Promise<CoffeeRankTier> {
        const row = await CoffeeRankTier.findByPk(id);
        if (!row) throw new NotFoundException(`Rank tier #${id} not found.`);
        await row.update(data);
        return row;
    }

    /**
     * Resolve the current rank for a given total points earned.
     * Reads from DB so admin edits take effect immediately.
     */
    async resolveRank(totalEarned: number): Promise<RankInfo> {
        const ranks = await this.findAll();

        let current = ranks[0];
        for (const r of ranks) {
            if (totalEarned >= r.min_points) current = r;
            else break;
        }

        const idx  = ranks.findIndex(r => r.id === current.id);
        const next = ranks[idx + 1] ?? null;

        return {
            level          : current.tier,
            name           : current.label,
            min_points     : current.min_points,
            max_points     : next?.min_points ?? null,
            next_rank_name : next?.label ?? null,
            points_to_next : next ? next.min_points - totalEarned : null,
        };
    }

    /**
     * Return the tier number and label for a total-points value.
     * Used by RewardEngineService on every purchase.
     */
    async tierFromTotal(total: number): Promise<{ tier: number; label: string }> {
        const ranks = await this.findAll();
        if (!ranks.length) return { tier: 1, label: 'Green Bean (Starter)' };

        let current = ranks[0];
        for (const r of ranks) {
            if (total >= r.min_points) current = r;
            else break;
        }
        return { tier: current.tier, label: current.label };
    }
}
