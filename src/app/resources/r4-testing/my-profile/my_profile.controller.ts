import UserDecorator from "@app/core/decorators/user.decorator";
import User from "@app/models/user/user.model";
import { Body, Controller, Get, Post } from "@nestjs/common";
import { MyProfileDto } from "./my_profile.dto";
import { MyProfileService } from "./my_profile.service";

@Controller()
export class MyProfileController {

    constructor(
        private readonly _service: MyProfileService
    ) { };

    @Get()
    async getMyProfile() {
        return await this._service.getMyProfile()
    }

    @Post()
    async create(
        @UserDecorator() auth: User,
        @Body() req: MyProfileDto,
    ) {
        return this._service.create(auth.id, req);
    }

}