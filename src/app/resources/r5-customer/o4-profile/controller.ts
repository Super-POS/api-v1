// ===========================================================================>> Core Library
import { Controller, Get } from '@nestjs/common';

// ===========================================================================>> Custom Library
import UserDecorator             from '@app/core/decorators/user.decorator';
import User                      from '@app/models/user/user.model';
import { CustomerProfileService } from './service';

@Controller()
export class CustomerProfileController {

    constructor(private readonly _service: CustomerProfileService) {}

    // =============================================>> Full customer profile
    @Get()
    async getProfile(@UserDecorator() user: User) {
        return await this._service.getProfile(user.id);
    }
}
