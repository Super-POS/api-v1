// ===========================================================================>> Core Library
import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { RolesDecorator }  from '@app/core/decorators/roles.decorator';
import UserDecorator       from '@app/core/decorators/user.decorator';
import { RoleGuard }       from '@app/core/guards/role.guard';
import { RoleEnum }        from '@app/enums/role.enum';
import User                from '@app/models/user/user.model';
import { AdminCashDrawerService } from './service';
import { CashDrawerLogQueryDto, DepositCashDto, ResetBalanceDto, WithdrawCashDto } from './dto';

@Controller()
@UseGuards(RoleGuard)
@RolesDecorator(RoleEnum.ADMIN)
export class AdminCashDrawerController {

    constructor(private readonly _service: AdminCashDrawerService) {}

    // =============================================>> View current cash drawer
    @Get()
    async getDrawer() {
        return await this._service.getDrawer();
    }

    // =============================================>> Deposit denominations into drawer
    @Post('deposit')
    async deposit(
        @Body() body: DepositCashDto,
        @UserDecorator() admin: User,
    ) {
        return await this._service.deposit(body, admin.id);
    }

    @Post('withdraw')
    async withdraw(
        @Body() body: WithdrawCashDto,
        @UserDecorator() admin: User,
    ) {
        return await this._service.withdraw(body, admin.id);
    }

    @Post('reset')
    async resetBalance(
        @Body() body: ResetBalanceDto,
        @UserDecorator() admin: User,
    ) {
        return await this._service.resetBalance(body ?? {}, admin.id);
    }

    // =============================================>> View transaction logs
    @Get('logs')
    async getLogs(@Query() query: CashDrawerLogQueryDto) {
        return await this._service.getLogs(query);
    }
}
