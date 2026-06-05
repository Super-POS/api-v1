import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { CoffeeRankTierService } from '@app/services/coffee-rank-tier.service';
import { UpdateCoffeeRankTierDto } from './dto';

@Controller()
export class AdminCoffeeRankController {
    constructor(private readonly _service: CoffeeRankTierService) {}

    /** List all 15 rank tiers ordered by tier number */
    @Get()
    async list() {
        return { data: await this._service.findAll() };
    }

    /** Update label or min_points for a specific tier */
    @Patch(':id')
    async update(
        @Param('id') id: string,
        @Body() body: UpdateCoffeeRankTierDto,
    ) {
        const data = await this._service.update(Number(id), body);
        return { data, message: 'Rank tier updated successfully.' };
    }
}
