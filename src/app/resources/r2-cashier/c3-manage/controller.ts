// =========================================================================>> Core Library
import { Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';

// =========================================================================>> Custom Library
import { OrderStatusEnum } from '@app/enums/order-status.enum';
import { ManageService }   from './service';

@Controller()
export class ManageController {

    constructor(private readonly _service: ManageService) {}

    // =============================================>> List active orders (optionally filter by status)
    @Get()
    async getOrders(@Query('status') status?: OrderStatusEnum) {
        return await this._service.getOrders(status);
    }

    // =============================================>> Accept order: pending → preparing
    @Patch(':id/accept')
    @HttpCode(HttpStatus.OK)
    async accept(@Param('id', ParseIntPipe) id: number) {
        return await this._service.accept(id);
    }

    // =============================================>> Start order: pending → preparing
    @Patch(':id/start')
    @HttpCode(HttpStatus.OK)
    async start(@Param('id', ParseIntPipe) id: number) {
        return await this._service.start(id);
    }

    // =============================================>> Ready: preparing → ready
    @Patch(':id/ready')
    @HttpCode(HttpStatus.OK)
    async ready(@Param('id', ParseIntPipe) id: number) {
        return await this._service.ready(id);
    }

    // =============================================>> Complete: ready → completed
    @Patch(':id/complete')
    @HttpCode(HttpStatus.OK)
    async complete(@Param('id', ParseIntPipe) id: number) {
        return await this._service.complete(id);
    }

    // =============================================>> Cancel order
    @Patch(':id/cancel')
    @HttpCode(HttpStatus.OK)
    async cancel(@Param('id', ParseIntPipe) id: number) {
        return await this._service.cancel(id);
    }
}
