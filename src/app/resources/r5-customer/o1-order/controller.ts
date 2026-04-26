// =========================================================================>> Core Library
import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseInterceptors } from '@nestjs/common';

// =========================================================================>> Custom Library
import { IdempotencyInterceptor } from '@app/core/interceptors/idempotency.interceptor';
import UserDecorator            from '@app/core/decorators/user.decorator';
import User                     from '@app/models/user/user.model';
import { PlaceOrderDto }        from './dto';
import { CustomerOrderService } from './service';

@Controller()
export class CustomerOrderController {

    constructor(private readonly _service: CustomerOrderService) {}

    // =============================================>> Place a new order
    @Post()
    @UseInterceptors(IdempotencyInterceptor)
    async placeOrder(
        @Body() body: PlaceOrderDto,
        @UserDecorator() user: User,
    ) {
        return await this._service.placeOrder(user.id, body);
    }

    // =============================================>> My order history
    @Get()
    async getMyOrders(
        @UserDecorator() user: User,
        @Query('page')  page?  : number,
        @Query('limit') limit? : number,
    ) {
        page  = !page  ? 1  : Number(page);
        limit = !limit ? 10 : Number(limit);
        return await this._service.getMyOrders(user.id, page, limit);
    }

    // =============================================>> Track a specific order
    @Get(':id')
    async trackOrder(
        @Param('id', ParseIntPipe) id: number,
        @UserDecorator() user: User,
    ) {
        return await this._service.trackOrder(id, user.id);
    }
}
