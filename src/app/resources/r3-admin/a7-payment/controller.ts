// ===========================================================================>> Core Library
import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { RolesDecorator }      from '@app/core/decorators/roles.decorator';
import { RoleGuard }           from '@app/core/guards/role.guard';
import { RoleEnum }            from '@app/enums/role.enum';
import UserDecorator           from '@app/core/decorators/user.decorator';
import User                    from '@app/models/user/user.model';
import { PaymentQueryDto, UpdatePaymentStatusDto } from './dto';
import { AdminPaymentService } from './service';

@Controller()
@UseGuards(RoleGuard)
@RolesDecorator(RoleEnum.ADMIN)
export class AdminPaymentController {

    constructor(private readonly _service: AdminPaymentService) {}

    // =============================================>> List
    @Get()
    async getData(@Query() query: PaymentQueryDto) {
        return await this._service.getData(query);
    }

    // =============================================>> View one
    @Get(':id')
    async view(@Param('id', ParseIntPipe) id: number) {
        return await this._service.view(id);
    }

    // =============================================>> Mark success
    @Patch(':id/success')
    async markSuccess(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: UpdatePaymentStatusDto,
        @UserDecorator() admin: User,
    ) {
        return await this._service.markSuccess(id, body, admin.id);
    }

    // =============================================>> Mark failed
    @Patch(':id/failed')
    async markFailed(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: UpdatePaymentStatusDto,
        @UserDecorator() admin: User,
    ) {
        return await this._service.markFailed(id, body, admin.id);
    }

    // =============================================>> Mark expired
    @Patch(':id/expired')
    async markExpired(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: UpdatePaymentStatusDto,
        @UserDecorator() admin: User,
    ) {
        return await this._service.markExpired(id, body, admin.id);
    }

    // =============================================>> Bulk-expire stale pending payments
    @Post('expire-stale')
    async expireStale() {
        return await this._service.expireStale();
    }
}
