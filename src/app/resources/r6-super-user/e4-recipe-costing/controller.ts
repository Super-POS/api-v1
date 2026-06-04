import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { RecipeCostingService } from './service';

@Controller()
export class RecipeCostingController {
    constructor(private readonly _service: RecipeCostingService) {}

    /** All menus with cost, margin, food_cost_pct, status, and can_produce */
    @Get()
    async getMenusWithCost() {
        const menus = await this._service.getMenusWithCost();
        return { data: menus.map(m => this._service.toFrontendListItem(m)) };
    }

    /** Dashboard summary: config health cards + avg margin/food-cost */
    @Get('summary')
    async getCostSummary() {
        const summary = await this._service.getCostSummary();
        return { data: this._service.toFrontendSummary(summary) };
    }

    /** Record cost snapshot for all menus (call manually or via cron) */
    @Post('snapshot')
    async snapshotCosts() {
        return this._service.snapshotCosts();
    }

    /** Full ingredient-level cost breakdown for one menu */
    @Get(':id')
    async getMenuCostDetail(@Param('id', ParseIntPipe) id: number) {
        const detail = await this._service.getMenuCostDetail(id);
        return { data: this._service.toFrontendDetail(detail) };
    }

    /** Cost history over time for one menu */
    @Get(':id/history')
    async getCostHistory(@Param('id', ParseIntPipe) id: number) {
        return this._service.getCostHistory(id);
    }

    /** Clone recipes from source menu into target menu */
    @Post(':sourceId/clone/:targetId')
    async cloneRecipe(
        @Param('sourceId', ParseIntPipe) sourceId: number,
        @Param('targetId', ParseIntPipe) targetId: number,
    ) {
        return this._service.cloneRecipe(sourceId, targetId);
    }
}
