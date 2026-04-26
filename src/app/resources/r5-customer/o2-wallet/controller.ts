// ===========================================================================>> Core Library
import { Body, Controller, Get, Post, Query } from '@nestjs/common';

// ===========================================================================>> Custom Library
import UserDecorator           from '@app/core/decorators/user.decorator';
import User                    from '@app/models/user/user.model';
import { RequestDepositDto }   from './dto';
import { CustomerWalletService } from './service';

@Controller()
export class CustomerWalletController {

    constructor(private readonly _service: CustomerWalletService) {}

    // =============================================>> Get wallet balance + recent transactions
    @Get()
    async getWallet(@UserDecorator() user: User) {
        return await this._service.getWallet(user.id);
    }

    // =============================================>> Request a deposit
    @Post('deposit')
    async requestDeposit(
        @Body() body: RequestDepositDto,
        @UserDecorator() user: User,
    ) {
        return await this._service.requestDeposit(user.id, body);
    }

    // =============================================>> Transaction history
    @Get('history')
    async getHistory(
        @UserDecorator() user: User,
        @Query('page')  page?  : number,
        @Query('limit') limit? : number,
    ) {
        page  = !page  ? 1  : Number(page);
        limit = !limit ? 10 : Number(limit);
        return await this._service.getHistory(user.id, page, limit);
    }
}
