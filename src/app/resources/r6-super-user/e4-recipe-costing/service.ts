import { Injectable, NotFoundException } from '@nestjs/common';
import Menu from '@app/models/menu/menu.model';
import MenuIngredient from '@app/models/menu/menu-ingredient.model';
import MenuSize from '@app/models/menu/menu-size.model';
import MenuType from '@app/models/menu/menu-type.model';

interface RecipeLine {
    ingredient_id: number;
    quantity     : number;
}

export interface IngredientCostLine {
    ingredient_id  : number;
    ingredient_name: string;
    unit           : string;
    quantity       : number;
    unit_cost      : number;
    line_cost      : number;
}

@Injectable()
export class RecipeCostingService {

    /**
     * Returns all menus with their auto-calculated product cost.
     *
     * Product Cost = Σ(Ingredient Amount × Ingredient Unit Cost)
     *
     * For menus with has_sizes=true, cost is calculated per size variant.
     */
    async getMenusWithCost() {
        const menus = await Menu.findAll({
            include: [
                { model: MenuType, attributes: ['id', 'name'] },
                MenuSize,
            ],
            order: [['name', 'ASC']],
        });

        const allIngredients = await MenuIngredient.findAll({
            attributes: ['id', 'name', 'unit', 'unit_cost'],
        });
        const ingredientMap = new Map(allIngredients.map(i => [i.id, i]));

        return menus.map(menu => {
            if (menu.has_sizes) {
                const sizesCost = (menu.sizes ?? []).map(s => ({
                    size      : s.size,
                    price     : s.price,
                    cost      : this._calcCost(s.recipes, ingredientMap),
                    margin_pct: this._marginPct(s.price, this._calcCost(s.recipes, ingredientMap)),
                }));
                return {
                    id        : menu.id,
                    code      : menu.code,
                    name      : menu.name,
                    type      : menu.type,
                    has_sizes : true,
                    sizes     : sizesCost,
                };
            }

            const cost = this._calcCost(menu.recipes as RecipeLine[], ingredientMap);
            return {
                id        : menu.id,
                code      : menu.code,
                name      : menu.name,
                type      : menu.type,
                has_sizes : false,
                price     : menu.unit_price,
                cost,
                margin_pct: this._marginPct(menu.unit_price ?? 0, cost),
            };
        });
    }

    /**
     * Full cost breakdown for one menu item.
     */
    async getMenuCostDetail(menu_id: number) {
        const menu = await Menu.findByPk(menu_id, {
            include: [
                { model: MenuType, attributes: ['id', 'name'] },
                MenuSize,
            ],
        });
        if (!menu) throw new NotFoundException('Menu not found.');

        const allIngredients = await MenuIngredient.findAll({
            attributes: ['id', 'name', 'unit', 'unit_cost'],
        });
        const ingredientMap = new Map(allIngredients.map(i => [i.id, i]));

        if (menu.has_sizes) {
            const sizes = (menu.sizes ?? []).map(s => {
                const lines = this._buildLines(s.recipes, ingredientMap);
                const cost  = lines.reduce((sum, l) => sum + l.line_cost, 0);
                return {
                    size      : s.size,
                    price     : s.price,
                    cost      : this._round(cost),
                    margin_pct: this._marginPct(s.price, cost),
                    ingredients: lines,
                };
            });
            return { id: menu.id, name: menu.name, type: menu.type, has_sizes: true, sizes };
        }

        const lines = this._buildLines(menu.recipes as RecipeLine[], ingredientMap);
        const cost  = lines.reduce((sum, l) => sum + l.line_cost, 0);
        return {
            id         : menu.id,
            name       : menu.name,
            type       : menu.type,
            has_sizes  : false,
            price      : menu.unit_price,
            cost       : this._round(cost),
            margin_pct : this._marginPct(menu.unit_price ?? 0, cost),
            ingredients: lines,
        };
    }

    /**
     * Summary statistics across all menus.
     */
    async getCostSummary() {
        const menus = await this.getMenusWithCost();

        const flat = menus.flatMap(m => {
            if ((m as any).has_sizes) {
                return (m as any).sizes.map((s: any) => ({
                    name: `${m.name} (${s.size})`,
                    price: s.price,
                    cost: s.cost,
                    margin_pct: s.margin_pct,
                }));
            }
            return [{ name: (m as any).name, price: (m as any).price, cost: (m as any).cost, margin_pct: (m as any).margin_pct }];
        }).filter(m => (m.price ?? 0) > 0);

        if (!flat.length) {
            return { total_items: 0, avg_cost: 0, avg_margin_pct: 0, highest_margin: null, lowest_margin: null };
        }

        const sorted = [...flat].sort((a, b) => b.margin_pct - a.margin_pct);
        const avgCost      = flat.reduce((s, m) => s + m.cost, 0) / flat.length;
        const avgMarginPct = flat.reduce((s, m) => s + m.margin_pct, 0) / flat.length;

        return {
            total_items    : flat.length,
            avg_cost       : this._round(avgCost),
            avg_margin_pct : this._round(avgMarginPct),
            highest_margin : sorted[0],
            lowest_margin  : sorted[sorted.length - 1],
        };
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private _calcCost(recipes: RecipeLine[], ingredientMap: Map<number, MenuIngredient>): number {
        if (!Array.isArray(recipes)) return 0;
        const cost = recipes.reduce((sum, line) => {
            const ing  = ingredientMap.get(line.ingredient_id);
            const uc   = ing ? Number(ing.unit_cost) : 0;
            return sum + Number(line.quantity) * uc;
        }, 0);
        return this._round(cost);
    }

    private _buildLines(recipes: RecipeLine[], ingredientMap: Map<number, MenuIngredient>): IngredientCostLine[] {
        if (!Array.isArray(recipes)) return [];
        return recipes.map(line => {
            const ing  = ingredientMap.get(line.ingredient_id);
            const uc   = ing ? Number(ing.unit_cost) : 0;
            return {
                ingredient_id  : line.ingredient_id,
                ingredient_name: ing?.name ?? 'Unknown',
                unit           : ing?.unit ?? '',
                quantity       : Number(line.quantity),
                unit_cost      : uc,
                line_cost      : this._round(Number(line.quantity) * uc),
            };
        });
    }

    private _marginPct(price: number, cost: number): number {
        const p = Number(price) || 0;
        if (p <= 0) return 0;
        return this._round(((p - cost) / p) * 100);
    }

    private _round(v: number, d = 4) {
        return parseFloat(v.toFixed(d));
    }
}
