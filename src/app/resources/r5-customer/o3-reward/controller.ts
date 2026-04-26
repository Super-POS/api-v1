// ===========================================================================>> Core Library
import { Body, Controller, Get, Post, Query } from '@nestjs/common';

// ===========================================================================>> Custom Library
import UserDecorator           from '@app/core/decorators/user.decorator';
import User                    from '@app/models/user/user.model';
import { RedeemRewardDto }     from './dto';
import { CustomerRewardService } from './service';

@Controller()
export class CustomerRewardController {

    constructor(private readonly _service: CustomerRewardService) {}

    // =============================================>> Reward profile (balance + history)
    @Get()
    async getProfile(@UserDecorator() user: User) {
        return await this._service.getProfile(user.id);
    }

    // =============================================>> Preview discount value before committing
    @Get('preview')
    async previewRedeem(@Query('points') points: number) {
        return await this._service.previewRedeem(Number(points ?? 0));
    }

    // =============================================>> Redeem points at checkout
    @Post('redeem')
    async redeem(@Body() body: RedeemRewardDto, @UserDecorator() user: User) {
        return await this._service.redeem(user.id, body);
    }
}
