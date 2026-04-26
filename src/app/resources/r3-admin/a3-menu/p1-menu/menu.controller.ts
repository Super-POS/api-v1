// ===========================================================================>> Core Library
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UsePipes } from '@nestjs/common';

// ===========================================================================>> Costom Library
import UserDecorator from '@app/core/decorators/user.decorator';
import { MenuTypeExistsPipe } from '@app/core/pipes/menu-type-exists.pipe';

import Menu from '@app/models/menu/menu.model';
import User from '@app/models/user/user.model';

import { CreateMenuDto, UpdateMenuDto } from './menu.dto';
import { MenuService } from './menu.service';
@Controller()
export class MenuController {

    constructor(private _service: MenuService) { };

    @Get('setup-data')
    async setup() {
        return await this._service.getSetupData();
    }

    @Get('/')
    async getData(

        @Query('page') page?: number,
        @Query('limit') limit?: number,
        @Query('key') key?: string,
        @Query('type') type?: number,
        @Query('creator') creator?: number,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('sort_by') sort_by?: string,
        @Query('order') order?: string
    ) {

        // Set defaul value if not defined. 
        page = !page ? 1 : page;
        limit = !limit ? 10 : limit;
        key = key === undefined ? null : key;
        sort_by = sort_by ?? 'name';
        order = order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const params = {
            page, limit, key, type, creator, startDate, endDate, sort_by, order,
        }

        // console.log(params)
        return await this._service.getData(params);
    }

    @Get('/:id')
    async view(@Param('id', ParseIntPipe) id: number) {
        return await this._service.view(id);
    }

    @Post()
    @UsePipes(MenuTypeExistsPipe)
    async create(@Body() body: CreateMenuDto, @UserDecorator() auth: User,): Promise<{ data: Menu, message: string }> {
        return await this._service.create(body, auth.id);
    }

    @Put(':id')
    @UsePipes(MenuTypeExistsPipe)
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: UpdateMenuDto
    ) {
        return this._service.update(body, id);
    }

    @Delete(':id')
    async delete(@Param('id') id: number): Promise<{ message: string }> {
        return await this._service.delete(id);
    }
}
