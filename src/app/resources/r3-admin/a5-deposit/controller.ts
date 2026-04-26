// ===========================================================================>> Core Library
import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';

// ===========================================================================>> Custom Library
import UserDecorator          from '@app/core/decorators/user.decorator';
import User                   from '@app/models/user/user.model';
import { CreateDepositDto, DepositQueryDto, ReviewDepositDto } from './dto';
import { AdminDepositService } from './service';

@Controller()
export class AdminDepositController {

    constructor(private readonly _service: AdminDepositService) {}

    // =============================================>> List deposit requests
    @Get()
    async getData(@Query() query: DepositQueryDto) {
        return await this._service.getData(query);
    }

    // =============================================>> View one deposit
    @Get(':id')
    async view(@Param('id', ParseIntPipe) id: number) {
        return await this._service.view(id);
    }

    // =============================================>> Create deposit (admin-initiated)
    @Post()
    async create(@Body() body: CreateDepositDto, @UserDecorator() admin: User) {
        return await this._service.create(body, admin.id);
    }

    // =============================================>> Approve deposit
    @Put(':id/approve')
    async approve(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: ReviewDepositDto,
        @UserDecorator() admin: User,
    ) {
        return await this._service.approve(id, body, admin.id);
    }

    // =============================================>> Reject deposit
    @Put(':id/reject')
    async reject(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: ReviewDepositDto,
        @UserDecorator() admin: User,
    ) {
        return await this._service.reject(id, body, admin.id);
    }
}
