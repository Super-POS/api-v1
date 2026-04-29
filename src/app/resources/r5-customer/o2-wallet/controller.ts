// ===========================================================================>> Core Library
import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';

// ===========================================================================>> Custom Library
import UserDecorator           from '@app/core/decorators/user.decorator';
import User                    from '@app/models/user/user.model';
import { BarayService } from 'src/app/services/baray.service';
import { CreateBarayWalletDepositIntentDto, RequestDepositDto }   from './dto';
import { CustomerWalletService } from './service';

@Controller()
export class CustomerWalletController {

    constructor(
        private readonly _service: CustomerWalletService,
        private readonly _baray: BarayService,
    ) {}

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

    @Post('deposit/baray/intent')
    async createBarayIntent(
        @Body() body: CreateBarayWalletDepositIntentDto,
        @UserDecorator() user: User,
    ) {
        const data = await this._baray.createIntentForCustomerWalletDeposit(user.id, body.amount, body.note);
        return {
            data,
            message: 'Open or scan the QR to complete your deposit.',
        };
    }

    @Get('deposit/:id/payment-state')
    async depositPaymentState(
        @Param('id', ParseIntPipe) id: number,
        @UserDecorator() user: User,
    ) {
        return await this._baray.getWalletDepositPaymentState(user.id, id);
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
