// ===========================================================================>> Core Library
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { AuditLogService }         from '@app/services/audit-log.service';
import MenuIngredient              from '@app/models/menu/menu-ingredient.model';
import Menu                        from '@app/models/menu/menu.model';
import User                        from '@app/models/user/user.model';
import IngredientWastage                   from '@app/models/menu/wastage.model';
import RecipeWastage                       from '@app/models/menu/recipe-wastage.model';
import { CreateIngredientWastageDto, CreateRecipeWastageDto } from './dto';

@Injectable()
export class WastageService {

    constructor(private readonly auditLog: AuditLogService) {}

    // ─── Ingredient Wastage ───────────────────────────────────────────────────

    async getIngredientWastages(ingredient_id?: number): Promise<any> {
        try {
            const where = ingredient_id ? { ingredient_id } : {};
            const data = await IngredientWastage.findAll({
                where,
                attributes: ['id', 'ingredient_id', 'reason', 'quantity', 'note', 'created_by', 'created_at'],
                include: [
                    { model: MenuIngredient, attributes: ['id', 'name', 'unit', 'quantity'] },
                    { model: User, as: 'creator', attributes: ['id', 'name', 'avatar'], required: false },
                ],
                order: [['created_at', 'DESC']],
            });

            return { data };
        } catch (error) {
            throw new BadRequestException('admin/wastage/ingredients/getData', error);
        }
    }

    async createIngredientWastage(body: CreateIngredientWastageDto, created_by?: number): Promise<any> {
        const ingredient = await MenuIngredient.findByPk(body.ingredient_id);
        if (!ingredient) {
            throw new NotFoundException('Ingredient is not found.');
        }

        const newQty = Number(ingredient.quantity) - body.quantity;
        if (newQty < 0) {
            throw new BadRequestException('Insufficient stock quantity for wastage.');
        }

        const record = await IngredientWastage.create({
            ingredient_id : body.ingredient_id,
            reason        : body.reason,
            quantity      : body.quantity,
            note          : body.note ?? null,
            created_by    : created_by ?? null,
        });

        await MenuIngredient.update({ quantity: newQty }, { where: { id: body.ingredient_id } });

        const data = await IngredientWastage.findByPk(record.id, {
            attributes: ['id', 'ingredient_id', 'reason', 'quantity', 'note', 'created_by', 'created_at'],
            include: [
                { model: MenuIngredient, attributes: ['id', 'name', 'unit', 'quantity'] },
                { model: User, as: 'creator', attributes: ['id', 'name', 'avatar'], required: false },
            ],
        });

        if (created_by) {
            await this.auditLog.log(created_by, 'INGREDIENT_WASTAGE', {
                wastageId      : record.id,
                ingredientId   : body.ingredient_id,
                ingredientName : ingredient.name,
                reason         : body.reason,
                quantity       : body.quantity,
                note           : body.note ?? null,
                newStock       : newQty,
            });
        }

        return { data, message: 'Ingredient wastage has been recorded.' };
    }

    // ─── Recipe Wastage ────────────────────────────────────────────────────────

    async getRecipeWastages(menu_id?: number): Promise<any> {
        try {
            const where = menu_id ? { menu_id } : {};
            const data = await RecipeWastage.findAll({
                where,
                attributes: ['id', 'menu_id', 'reason', 'quantity', 'note', 'created_by', 'created_at'],
                include: [
                    { model: Menu, attributes: ['id', 'code', 'name', 'image', 'unit_price', 'recipes'] },
                    { model: User, as: 'creator', attributes: ['id', 'name', 'avatar'], required: false },
                ],
                order: [['created_at', 'DESC']],
            });

            return { data };
        } catch (error) {
            throw new BadRequestException('admin/wastage/recipes/getData', error);
        }
    }

    async createRecipeWastage(body: CreateRecipeWastageDto, created_by?: number): Promise<any> {
        const menu = await Menu.findByPk(body.menu_id);
        if (!menu) {
            throw new NotFoundException('Recipe (menu item) is not found.');
        }

        const recipes: { ingredient_id: number; quantity: number }[] = Array.isArray(menu.recipes)
            ? menu.recipes
            : [];

        // Deduct each ingredient's stock proportional to the number of servings wasted
        for (const recipeItem of recipes) {
            const ingredient = await MenuIngredient.findByPk(recipeItem.ingredient_id);
            if (!ingredient) continue;

            const deduction = recipeItem.quantity * body.quantity;
            const newQty    = Math.max(0, Number(ingredient.quantity) - deduction);
            await MenuIngredient.update({ quantity: newQty }, { where: { id: recipeItem.ingredient_id } });
        }

        const record = await RecipeWastage.create({
            menu_id    : body.menu_id,
            reason     : body.reason,
            quantity   : body.quantity,
            note       : body.note ?? null,
            created_by : created_by ?? null,
        });

        const data = await RecipeWastage.findByPk(record.id, {
            attributes: ['id', 'menu_id', 'reason', 'quantity', 'note', 'created_by', 'created_at'],
            include: [
                { model: Menu, attributes: ['id', 'code', 'name', 'image', 'unit_price', 'recipes'] },
                { model: User, as: 'creator', attributes: ['id', 'name', 'avatar'], required: false },
            ],
        });

        if (created_by) {
            await this.auditLog.log(created_by, 'RECIPE_WASTAGE', {
                wastageId  : record.id,
                menuId     : body.menu_id,
                menuName   : menu.name,
                reason     : body.reason,
                quantity   : body.quantity,
                note       : body.note ?? null,
                recipesAffected: recipes.length,
            });
        }

        return { data, message: 'Recipe wastage has been recorded.' };
    }
}
