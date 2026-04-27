// =========================================================================>> Core Library
import { BadRequestException } from '@nestjs/common';

// =========================================================================>> Third Party Library
import { Transaction } from 'sequelize';

// =========================================================================>> Custom Library
import MenuIngredient from '@app/models/menu/menu-ingredient.model';
import Menu from '@app/models/menu/menu.model';
import ModifierOption from '@app/models/menu/modifier-option.model';
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

/** Modifier recipe lines can be zero to override a base ingredient to 0 (e.g. sugar 0%). */
function parseModifierRecipesJson(raw: unknown): MenuRecipeLine[] {
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
                r.quantity >= 0,
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

/**
 * For each selected modifier option, apply `ingredient_recipe` (per single product unit) × order line qty to stock.
 * Runs after `deductStockForMenuRecipeLines` (menu base recipe).
 */
export async function deductStockForModifierOptionRecipes(
    menu: Menu,
    options: Pick<ModifierOption, 'id' | 'label' | 'ingredient_recipe'>[],
    orderLineQty: number,
    transaction: Transaction,
    optionsMeta: { receiptRef: string; createdBy: number | null },
): Promise<void> {
    const baseLines = parseMenuRecipesJson((menu as any).get?.('recipes') ?? (menu as any).recipes);
    const baseByIngredient = new Map<number, number>();
    for (const line of baseLines) {
        baseByIngredient.set(line.ingredient_id, Number(line.quantity));
    }

    for (const opt of options) {
        const lines = parseModifierRecipesJson((opt as any).ingredient_recipe);
        for (const line of lines) {
            const ingredient = await MenuIngredient.findByPk(line.ingredient_id, { transaction });
            if (!ingredient) {
                throw new BadRequestException(
                    `Ingredient #${line.ingredient_id} not found for modifier option #${opt.id} ("${opt.label}").`,
                );
            }
            const targetQtyPerUnit = Number(line.quantity);
            const baseQtyPerUnit = Number(baseByIngredient.get(line.ingredient_id) ?? 0);
            const deduction = (targetQtyPerUnit - baseQtyPerUnit) * orderLineQty;
            const currentQty = Number(ingredient.quantity);

            // No delta vs base recipe; nothing to do.
            if (deduction === 0) {
                continue;
            }

            // Positive delta = consume more than base recipe.
            if (deduction > 0 && currentQty < deduction) {
                throw new BadRequestException(
                    `Insufficient stock for "${ingredient.name}" (modifier: ${opt.label}). Available: ${currentQty}, required: ${deduction}.`,
                );
            }

            if (deduction > 0) {
                await IngredientStockMovement.create(
                    {
                        ingredient_id: line.ingredient_id,
                        type: StockMovementType.OUT,
                        quantity: deduction,
                        note: `Order #${optionsMeta.receiptRef} · ${opt.label}`,
                        created_by: optionsMeta.createdBy,
                    },
                    { transaction },
                );
                await MenuIngredient.update(
                    { quantity: currentQty - deduction },
                    { where: { id: line.ingredient_id }, transaction },
                );
            } else {
                const restoreQty = Math.abs(deduction);
                await IngredientStockMovement.create(
                    {
                        ingredient_id: line.ingredient_id,
                        type: StockMovementType.IN,
                        quantity: restoreQty,
                        note: `Order #${optionsMeta.receiptRef} · ${opt.label} override`,
                        created_by: optionsMeta.createdBy,
                    },
                    { transaction },
                );
                await MenuIngredient.update(
                    { quantity: currentQty + restoreQty },
                    { where: { id: line.ingredient_id }, transaction },
                );
            }
        }
    }
}
