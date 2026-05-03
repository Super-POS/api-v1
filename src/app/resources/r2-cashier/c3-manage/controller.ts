// =========================================================================>> Core Library
import { Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';

// =========================================================================>> Custom Library
import UserDecorator from '@app/core/decorators/user.decorator';
import User from '@app/models/user/user.model';
import { OrderStatusEnum } from '@app/enums/order-status.enum';
import { ManageService }   from './service';

@Controller()
export class ManageController {

    constructor(private readonly _service: ManageService) {}

    /** Website (customer web) orders awaiting payment or cashier acceptance — listed before kitchen queue. */
    @Get('incoming-website')
    async getIncomingWebsiteOrders() {
        return await this._service.getIncomingWebsiteOrders();
    }

    // =============================================>> List active orders (optionally filter by status)
    @Get()
    async getOrders(@Query('status') status?: OrderStatusEnum) {
        return await this._service.getOrders(status);
    }

    // =============================================>> Accept order: pending → preparing
    @Patch(':id/accept')
    @HttpCode(HttpStatus.OK)
    async accept(@UserDecorator() auth: User, @Param('id', ParseIntPipe) id: number) {
        return await this._service.accept(id, auth.id);
    }

    // =============================================>> Start order: pending → preparing
    @Patch(':id/start')
    @HttpCode(HttpStatus.OK)
    async start(@UserDecorator() auth: User, @Param('id', ParseIntPipe) id: number) {
        return await this._service.start(id, auth.id);
    }

    // =============================================>> Ready: preparing → ready
    @Patch(':id/ready')
    @HttpCode(HttpStatus.OK)
    async ready(@UserDecorator() auth: User, @Param('id', ParseIntPipe) id: number) {
        return await this._service.ready(id, auth.id);
    }

    // =============================================>> Web queue: finish (preparing or ready → completed)
    @Patch(':id/finish-web')
    @HttpCode(HttpStatus.OK)
    async finishWeb(@UserDecorator() auth: User, @Param('id', ParseIntPipe) id: number) {
        return await this._service.finishWebsite(id, auth.id);
    }

    // =============================================>> Complete: ready → completed
    @Patch(':id/complete')
    @HttpCode(HttpStatus.OK)
    async complete(@UserDecorator() auth: User, @Param('id', ParseIntPipe) id: number) {
        return await this._service.complete(id, auth.id);
    }

    // =============================================>> Cancel order
    @Patch(':id/cancel')
    @HttpCode(HttpStatus.OK)
    async cancel(@UserDecorator() auth: User, @Param('id', ParseIntPipe) id: number) {
        return await this._service.cancel(id, auth.id);
    }
}
