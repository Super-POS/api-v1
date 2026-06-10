import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CoffeeRankTierService } from '@app/services/coffee-rank-tier.service';
import { AdminRankRewardService } from './reward.service';
import { CreateRankRewardDto, UpdateCoffeeRankTierDto, UpdateRankRewardDto } from './dto';

@Controller()
export class AdminCoffeeRankController {
    constructor(
        private readonly _service      : CoffeeRankTierService,
        private readonly _rewardService: AdminRankRewardService,
    ) {}

    /** List all 15 rank tiers with their rewards */
    @Get()
    async list() {
        return { data: await this._service.findAll() };
    }

    /** Update label, min_points, or icon for a specific tier */
    @Patch(':id')
    async update(
        @Param('id') id: string,
        @Body() body: UpdateCoffeeRankTierDto,
    ) {
        const data = await this._service.update(Number(id), body);
        return { data, message: 'Rank tier updated successfully.' };
    }

    /** List all rewards for a specific tier */
    @Get(':tierId/rewards')
    async listRewards(@Param('tierId') tierId: string) {
        return { data: await this._rewardService.list(Number(tierId)) };
    }

    /** Add a reward to a tier */
    @Post(':tierId/rewards')
    async createReward(
        @Param('tierId') tierId: string,
        @Body() body: CreateRankRewardDto,
    ) {
        const data = await this._rewardService.create(Number(tierId), body);
        return { data, message: 'Reward added to tier.' };
    }

    /** Update a reward */
    @Patch(':tierId/rewards/:rewardId')
    async updateReward(
        @Param('tierId') tierId: string,
        @Param('rewardId') rewardId: string,
        @Body() body: UpdateRankRewardDto,
    ) {
        const data = await this._rewardService.update(Number(tierId), Number(rewardId), body);
        return { data, message: 'Reward updated.' };
    }

    /** Remove a reward from a tier */
    @Delete(':tierId/rewards/:rewardId')
    async deleteReward(
        @Param('tierId') tierId: string,
        @Param('rewardId') rewardId: string,
    ) {
        await this._rewardService.remove(Number(tierId), Number(rewardId));
        return { message: 'Reward removed.' };
    }
}
