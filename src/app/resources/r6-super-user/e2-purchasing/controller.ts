import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import UserDecorator from '@app/core/decorators/user.decorator';
import User from '@app/models/user/user.model';
import { PurchaseOrderStatus } from '@app/models/erp/purchase-order.model';
import { PurchasingService } from './service';
import {
    CreatePurchaseOrderDto, CreateSupplierDto,
    ReceiveGoodsDto, UpdatePOStatusDto, UpdateSupplierDto,
} from './dto';

@Controller()
export class PurchasingController {
    constructor(private readonly _service: PurchasingService) {}

    // ─── Suppliers ────────────────────────────────────────────────────────────

    @Get('suppliers')
    getSuppliers(@Query('active') active?: string) {
        return this._service.getSuppliers(active === 'true');
    }

    @Get('suppliers/:id')
    getSupplier(@Param('id', ParseIntPipe) id: number) {
        return this._service.getSupplier(id);
    }

    @Post('suppliers')
    createSupplier(@Body() dto: CreateSupplierDto) {
        return this._service.createSupplier(dto);
    }

    @Patch('suppliers/:id')
    updateSupplier(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSupplierDto) {
        return this._service.updateSupplier(id, dto);
    }

    // ─── Purchase Orders ──────────────────────────────────────────────────────

    @Get('purchase-orders')
    getPurchaseOrders(
        @Query('supplier_id') supplier_id?: number,
        @Query('status') status?: PurchaseOrderStatus,
    ) {
        return this._service.getPurchaseOrders(supplier_id, status);
    }

    @Get('purchase-orders/:id')
    getPurchaseOrder(@Param('id', ParseIntPipe) id: number) {
        return this._service.getPurchaseOrder(id);
    }

    @Post('purchase-orders')
    createPurchaseOrder(@Body() dto: CreatePurchaseOrderDto, @UserDecorator() auth: User) {
        return this._service.createPurchaseOrder(dto, auth.id);
    }

    @Patch('purchase-orders/:id/status')
    updatePOStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePOStatusDto) {
        return this._service.updatePOStatus(id, dto);
    }

    @Post('purchase-orders/:id/receive')
    receiveGoods(@Param('id', ParseIntPipe) id: number, @Body() dto: ReceiveGoodsDto) {
        return this._service.receiveGoods(id, dto);
    }
}
