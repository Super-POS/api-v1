// ===========================================================================>> Core Library
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { RolesDecorator }  from '@app/core/decorators/roles.decorator';
import UserDecorator       from '@app/core/decorators/user.decorator';
import { RoleGuard }       from '@app/core/guards/role.guard';
import { RoleEnum }        from '@app/enums/role.enum';
import User                from '@app/models/user/user.model';
import { CashierCashDrawerService } from './service';
import { MakeChangeDto, PreviewChangeDto } from './dto';

@Controller()
@UseGuards(RoleGuard)
@RolesDecorator(RoleEnum.CASHIER)
export class CashierCashDrawerController {

    constructor(private readonly _service: CashierCashDrawerService) {}

    // =============================================>> View current cash drawer
    @Get()
    async getDrawer() {
        return await this._service.getDrawer();
    }

    // =============================================>> Process payment and give change
    @Post('change-preview')
    async previewChange(@Body() body: PreviewChangeDto) {
        return await this._service.previewChange(body);
    }

    @Post('change')
    async makeChange(
        @Body() body: MakeChangeDto,
        @UserDecorator() cashier: User,
    ) {
        return await this._service.makeChange(body, cashier.id);
    }
}
