import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { RecipeCostingService } from './service';

@Controller()
export class RecipeCostingController {
    constructor(private readonly _service: RecipeCostingService) {}

    /** All menus with auto-calculated cost and margin */
    @Get()
    async getMenusWithCost() {
        const menus = await this._service.getMenusWithCost();
        return { data: menus.map(m => this._service.toFrontendListItem(m)) };
    }

    /** Summary stats: avg cost, avg margin, best/worst margin items */
    @Get('summary')
    async getCostSummary() {
        const summary = await this._service.getCostSummary();
        return { data: this._service.toFrontendSummary(summary) };
    }

    /** Full ingredient-level cost breakdown for one menu */
    @Get(':id')
    async getMenuCostDetail(@Param('id', ParseIntPipe) id: number) {
        const detail = await this._service.getMenuCostDetail(id);
        return { data: this._service.toFrontendDetail(detail) };
    }
}
