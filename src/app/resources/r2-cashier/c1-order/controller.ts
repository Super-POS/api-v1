// =========================================================================>> Core Library
import { Body, Controller, Get, Post, UseInterceptors } from '@nestjs/common';

// =========================================================================>> Custom Library
import { IdempotencyInterceptor } from '@app/core/interceptors/idempotency.interceptor';
import UserDecorator from '@app/core/decorators/user.decorator';
import User from '@app/models/user/user.model';
import Order from '@app/models/order/order.model';
import Menu from '@app/models/menu/menu.model';
import { CreateOrderDto } from './dto';
import { OrderService } from './service';

// ======================================= >> Code Starts Here << ========================== //
@Controller()
export class OrderController {

    constructor(private readonly _service: OrderService) { };

    @Get('menus')
    async getMenus(): Promise<{ data: { id: number, name: string, menus: Menu[] }[] }> {
        return await this._service.getMenus();
    }

    @Post('order')
    @UseInterceptors(IdempotencyInterceptor)
    async makeOrder(@Body() body: CreateOrderDto, @UserDecorator() user: User): Promise<{ data: Order, message: string }> {
        return await this._service.makeOrder(user.id, body);
    }
    
}
