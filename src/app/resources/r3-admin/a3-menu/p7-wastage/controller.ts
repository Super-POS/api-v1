// ===========================================================================>> Core Library
import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { RolesDecorator }              from '@app/core/decorators/roles.decorator';
import { RoleGuard }                   from '@app/core/guards/role.guard';
import { RoleEnum }                    from '@app/enums/role.enum';
import UserDecorator                   from '@app/core/decorators/user.decorator';
import User                            from '@app/models/user/user.model';
import { CreateIngredientWastageDto, CreateRecipeWastageDto } from './dto';
import { WastageService }              from './service';

@Controller()
export class WastageController {

    constructor(private readonly _service: WastageService) {}

    // ─── Ingredient Wastage ───────────────────────────────────────────────────

    /** GET /api/admin/wastages/ingredients?ingredient_id= */
    @Get('ingredients')
    async getIngredientWastages(@Query('ingredient_id') ingredient_id?: string) {
        return await this._service.getIngredientWastages(
            ingredient_id ? parseInt(ingredient_id, 10) : undefined,
        );
    }

    /** POST /api/admin/wastages/ingredients */
    @Post('ingredients')
    @UseGuards(RoleGuard)
    @RolesDecorator(RoleEnum.ADMIN)
    async createIngredientWastage(
        @Body() body: CreateIngredientWastageDto,
        @UserDecorator() user: User,
    ) {
        return await this._service.createIngredientWastage(body, user.id);
    }

    // ─── Recipe Wastage ────────────────────────────────────────────────────────

    /** GET /api/admin/wastages/recipes?menu_id= */
    @Get('recipes')
    async getRecipeWastages(@Query('menu_id') menu_id?: string) {
        return await this._service.getRecipeWastages(
            menu_id ? parseInt(menu_id, 10) : undefined,
        );
    }

    /** POST /api/admin/wastages/recipes */
    @Post('recipes')
    @UseGuards(RoleGuard)
    @RolesDecorator(RoleEnum.ADMIN)
    async createRecipeWastage(
        @Body() body: CreateRecipeWastageDto,
        @UserDecorator() user: User,
    ) {
        return await this._service.createRecipeWastage(body, user.id);
    }
}
