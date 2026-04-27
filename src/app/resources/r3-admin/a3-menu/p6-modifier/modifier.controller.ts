// ===========================================================================>> Core Library
import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Put,
} from '@nestjs/common';
// ===========================================================================>> Custom Library
import {
    CreateModifierGroupDto,
    CreateModifierOptionDto,
    SetMenuModifiersDto,
    UpdateModifierGroupDto,
    UpdateModifierOptionDto,
} from './modifier.dto';
import { ModifierAdminService } from './modifier.service';

@Controller()
export class ModifierAdminController {
    constructor(private readonly _service: ModifierAdminService) {}

    // ---------------- groups
    @Get('groups')
    async listGroups() {
        return this._service.listGroups();
    }

    @Post('groups')
    async createGroup(@Body() body: CreateModifierGroupDto) {
        return this._service.createGroup(body);
    }

    @Put('groups/:id')
    async updateGroup(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateModifierGroupDto) {
        return this._service.updateGroup(id, body);
    }

    @Delete('groups/:id')
    async deleteGroup(@Param('id', ParseIntPipe) id: number) {
        return this._service.deleteGroup(id);
    }

    // ---------------- options
    @Post('groups/:groupId/options')
    async createOption(
        @Param('groupId', ParseIntPipe) groupId: number,
        @Body() body: CreateModifierOptionDto,
    ) {
        return this._service.createOption(groupId, body);
    }

    @Put('options/:id')
    async updateOption(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateModifierOptionDto) {
        return this._service.updateOption(id, body);
    }

    @Delete('options/:id')
    async deleteOption(@Param('id', ParseIntPipe) id: number) {
        return this._service.deleteOption(id);
    }

    // ---------------- per-menu
    @Get('menus/:menuId/assignments')
    async getMenuAssignments(@Param('menuId', ParseIntPipe) menuId: number) {
        return this._service.getMenuAssignments(menuId);
    }

    @Put('menus/:menuId/assignments')
    async setMenuAssignments(
        @Param('menuId', ParseIntPipe) menuId: number,
        @Body() body: SetMenuModifiersDto,
    ) {
        return this._service.setMenuAssignments(menuId, body);
    }
}
