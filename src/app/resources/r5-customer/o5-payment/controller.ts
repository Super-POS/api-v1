// ===========================================================================>> Core Library
import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseInterceptors } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { IdempotencyInterceptor } from '@app/core/interceptors/idempotency.interceptor';
import UserDecorator            from '@app/core/decorators/user.decorator';
import User                     from '@app/models/user/user.model';
import { InitiatePaymentDto }   from './dto';
import { CustomerPaymentService } from './service';

@Controller()
export class CustomerPaymentController {

    constructor(private readonly _service: CustomerPaymentService) {}

    // =============================================>> Initiate payment for an order
    @Post()
    @UseInterceptors(IdempotencyInterceptor)
    async initiate(@Body() body: InitiatePaymentDto, @UserDecorator() user: User) {
        return await this._service.initiate(user.id, body);
    }

    // =============================================>> All payment transactions by order
    @Get('order/:orderId')
    async getByOrder(
        @Param('orderId', ParseIntPipe) orderId: number,
        @UserDecorator() user: User,
    ) {
        return await this._service.getByOrder(orderId, user.id);
    }

    // =============================================>> My full payment history
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

    // =============================================>> Check / refresh expiry of a specific payment
    @Get(':id/check-expiry')
    async checkExpiry(
        @Param('id', ParseIntPipe) id: number,
        @UserDecorator() user: User,
    ) {
        return await this._service.checkExpiry(id, user.id);
    }
}
