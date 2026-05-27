import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { RecipeCostingService } from './service';

@Controller()
export class RecipeCostingController {
    constructor(private readonly _service: RecipeCostingService) {}

    /** All menus with auto-calculated cost and margin */
    @Get()
    getMenusWithCost() {
        return this._service.getMenusWithCost();
    }

    /** Summary stats: avg cost, avg margin, best/worst margin items */
    @Get('summary')
    getCostSummary() {
        return this._service.getCostSummary();
    }

    /** Full ingredient-level cost breakdown for one menu */
    @Get(':id')
    getMenuCostDetail(@Param('id', ParseIntPipe) id: number) {
        return this._service.getMenuCostDetail(id);
    }
}
