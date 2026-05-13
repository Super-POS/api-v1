// ===========================================================================>> Core Library
import { Body, Controller, Get, Post, Query } from '@nestjs/common';

// ===========================================================================>> Custom Library
import UserDecorator             from '@app/core/decorators/user.decorator';
import User                      from '@app/models/user/user.model';
import { AssignBadgeDto, RedeemRewardDto } from './dto';
import { CustomerRewardService } from './service';

@Controller()
export class CustomerRewardController {

    constructor(private readonly _service: CustomerRewardService) {}

    // =============================================>> Reward profile (balance + history + rank + badge)
    @Get()
    async getProfile(@UserDecorator() user: User) {
        return await this._service.getProfile(user.id);
    }

    // =============================================>> Current rank only
    @Get('rank')
    async getRank(@UserDecorator() user: User) {
        return await this._service.getRank(user.id);
    }

    // =============================================>> Badge questions to show user
    @Get('badge/questions')
    getBadgeQuestions() {
        return this._service.getBadgeQuestions();
    }

    // =============================================>> Submit answers → LLM assigns badge
    @Post('badge')
    async assignBadge(@Body() body: AssignBadgeDto, @UserDecorator() user: User) {
        return await this._service.assignBadge(user.id, body);
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
