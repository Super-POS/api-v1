// ===========================================================================>> Core Library
import { Controller, Get, Param, Post } from '@nestjs/common';

// ===========================================================================>> Custom Library
import UserDecorator             from '@app/core/decorators/user.decorator';
import User                      from '@app/models/user/user.model';
import { CustomerMissionService } from './service';

@Controller()
export class CustomerMissionController {

    constructor(private readonly _service: CustomerMissionService) {}

    // =============================================>> List active missions with my progress
    @Get()
    async listAvailable(@UserDecorator() user: User) {
        return { data: await this._service.listAvailable(user.id) };
    }

    // =============================================>> My accepted missions and progress
    @Get('my')
    async myMissions(@UserDecorator() user: User) {
        return { data: await this._service.myMissions(user.id) };
    }

    // =============================================>> Accept / join a mission
    @Post(':id/accept')
    async accept(@Param('id') id: string, @UserDecorator() user: User) {
        const data = await this._service.accept(user.id, Number(id));
        return { data, message: 'Mission accepted. Good luck!' };
    }

    // =============================================>> My stamp passport
    @Get('stamps')
    async myStamps(@UserDecorator() user: User) {
        return { data: await this._service.myStamps(user.id) };
    }
}
