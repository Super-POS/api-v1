// ===========================================================================>> Core Library
import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';

// ===========================================================================>> Custom Library
import UserDecorator           from '@app/core/decorators/user.decorator';
import User                    from '@app/models/user/user.model';
import { BakongService } from 'src/app/services/bakong.service';
import { BarayService } from 'src/app/services/baray.service';
import {
    CreateBakongWalletDepositIntentDto,
    CreateBarayWalletDepositIntentDto,
    RequestDepositDto,
} from './dto';
import { CustomerWalletService } from './service';

@Controller()
export class CustomerWalletController {

    constructor(
        private readonly _service: CustomerWalletService,
        private readonly _baray: BarayService,
        private readonly _bakong: BakongService,
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

    @Post('deposit/bakong/intent')
    async createBakongIntent(
        @Body() body: CreateBakongWalletDepositIntentDto,
        @UserDecorator() user: User,
    ) {
        const data = await this._bakong.createIntentForCustomerWalletDeposit(user.id, body.amount, body.note);
        return {
            data,
            message: 'Scan the QR with any KHQR-enabled bank app to complete your deposit.',
        };
    }

    @Get('deposit/:id/payment-state')
    async depositPaymentState(
        @Param('id', ParseIntPipe) id: number,
        @UserDecorator() user: User,
    ) {
        const channel = await this._service.getDepositChannel(user.id, id);
        if (channel === 'bakong') {
            return await this._bakong.getWalletDepositPaymentState(user.id, id);
        }
        return await this._baray.getWalletDepositPaymentState(user.id, id);
    }

    @Post('deposit/bakong/abandon-pending')
    async abandonAllPendingBakongDeposits(@UserDecorator() user: User) {
        const result = await this._bakong.abandonAllPendingBakongWalletDeposits(user.id);
        return {
            ...result,
            message:
                result.data.abandoned_count > 0
                    ? 'Pending deposit cancelled. You can start a new top-up.'
                    : 'No pending deposit to cancel.',
        };
    }

    @Post('deposit/bakong/:id/abandon')
    async abandonBakongDeposit(
        @Param('id', ParseIntPipe) id: number,
        @UserDecorator() user: User,
    ) {
        const result = await this._bakong.abandonPendingBakongWalletDeposit(user.id, id);
        return {
            ...result,
            message: result.data.abandoned
                ? 'Previous deposit QR cancelled.'
                : 'No active deposit QR to cancel.',
        };
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
