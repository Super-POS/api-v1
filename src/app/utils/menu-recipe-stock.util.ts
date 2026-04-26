// =========================================================================>> Core Library
import { BadRequestException } from '@nestjs/common';

// =========================================================================>> Third Party Library
import { Transaction } from 'sequelize';

// =========================================================================>> Custom Library
import MenuIngredient from '@app/models/menu/menu-ingredient.model';
import Menu from '@app/models/menu/menu.model';
import IngredientStockMovement, { StockMovementType } from '@app/models/menu/stock_movement.model';

export type MenuRecipeLine = { ingredient_id: number; quantity: number };

export function parseMenuRecipesJson(raw: unknown): MenuRecipeLine[] {
    if (raw == null) return [];
    if (!Array.isArray(raw)) return [];
    return raw
        .map((r: any) => ({
            ingredient_id: Number(r?.ingredient_id),
            quantity: Number(r?.quantity),
        }))
        .filter(
            (r) =>
                Number.isFinite(r.ingredient_id) &&
                r.ingredient_id > 0 &&
                Number.isFinite(r.quantity) &&
                r.quantity > 0,
        );
}

/**
 * When an order line is created, reduce ingredient stock using `Menu.recipes` (JSON on `menus` table).
 */
export async function deductStockForMenuRecipeLines(
    menu: Menu,
    orderLineQty: number,
    transaction: Transaction,
    options: { receiptRef: string; createdBy: number | null },
): Promise<void> {
    const lines = parseMenuRecipesJson((menu as any).get?.('recipes') ?? (menu as any).recipes);
    for (const line of lines) {
        const ingredient = await MenuIngredient.findByPk(line.ingredient_id, { transaction });
        if (!ingredient) {
            throw new BadRequestException(
                `Ingredient #${line.ingredient_id} not found for menu "${menu.name}".`,
            );
        }

        const deduction = Number(line.quantity) * orderLineQty;
        const currentQty = Number(ingredient.quantity);

        if (currentQty < deduction) {
            throw new BadRequestException(
                `Insufficient stock for ingredient "${ingredient.name}". Available: ${currentQty}, required: ${deduction}.`,
            );
        }

        await IngredientStockMovement.create(
            {
                ingredient_id: line.ingredient_id,
                type: StockMovementType.OUT,
                quantity: deduction,
                note: `Order #${options.receiptRef}`,
                created_by: options.createdBy,
            },
            { transaction },
        );

        await MenuIngredient.update(
            { quantity: currentQty - deduction },
            { where: { id: line.ingredient_id }, transaction },
        );
    }
}
