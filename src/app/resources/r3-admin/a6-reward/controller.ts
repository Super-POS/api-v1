// ===========================================================================>> Core Library
import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { AdminRewardService } from './service';

@Controller()
export class AdminRewardController {

    constructor(private readonly _service: AdminRewardService) {}

    // =============================================>> All reward transactions
    @Get()
    async getData(
        @Query('page')        page?        : number,
        @Query('limit')       limit?       : number,
        @Query('customer_id') customer_id? : number,
    ) {
        page        = !page        ? 1  : Number(page);
        limit       = !limit       ? 10 : Number(limit);
        customer_id = customer_id  ? Number(customer_id) : undefined;
        return await this._service.getData(page, limit, customer_id);
    }

    // =============================================>> Reward profile of a specific customer
    @Get('customers/:id')
    async viewCustomer(@Param('id', ParseIntPipe) id: number) {
        return await this._service.viewCustomer(id);
    }
}
