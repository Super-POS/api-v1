import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import Menu from '@app/models/menu/menu.model';
import MenuIngredient from '@app/models/menu/menu-ingredient.model';
import MenuSize from '@app/models/menu/menu-size.model';
import MenuType from '@app/models/menu/menu-type.model';

export type RecipeStatus = 'complete' | 'missing_recipe' | 'missing_cost' | 'inactive';

interface RecipeLine { ingredient_id: number; quantity: number; }

export interface IngredientCostLine {
    ingredient_id        : number;
    ingredient_name      : string;
    unit                 : string;
    quantity             : number;
    unit_cost            : number;
    line_cost            : number;
    stock_on_hand        : number;
    can_produce_from_this: number;
}

interface CostMetrics { cost: number; profit: number; food_cost_pct: number; margin_pct: number; }

interface SizeResult {
    size         : string;
    price        : number;
    status       : RecipeStatus;
    can_produce  : number;
    cost         : number;
    profit       : number;
    food_cost_pct: number;
    margin_pct   : number;
    ingredients? : IngredientCostLine[];
}

interface MenuCostResult {
    id           : number;
    code         : string;
    name         : string;
    type         : any;
    is_available : boolean;
    has_sizes    : boolean;
    status?      : RecipeStatus;
    price?       : number;
    cost?        : number;
    profit?      : number;
    food_cost_pct?: number;
    margin_pct?  : number;
    can_produce? : number;
    ingredients? : IngredientCostLine[];
    sizes?       : SizeResult[];
}

@Injectable()
export class RecipeCostingService {

    constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

    async getMenusWithCost(): Promise<MenuCostResult[]> {
        const menus = await Menu.findAll({
            include: [
                { model: MenuType, attributes: ['id', 'name'] },
                MenuSize,
            ],
            order: [['name', 'ASC']],
        });

        const ingredientMap = await this._loadIngredientMap();

        return menus.map(menu => {
            if (menu.has_sizes) {
                const sizes: SizeResult[] = (menu.sizes ?? []).map(s => ({
                    size         : s.size,
                    price        : s.price,
                    status       : this._recipeStatus(s.recipes, ingredientMap, menu.is_available),
                    can_produce  : this._canProduce(s.recipes, ingredientMap),
                    ...this._calcMetrics(s.recipes, ingredientMap, s.price),
                }));
                return { id: menu.id, code: menu.code, name: menu.name, type: menu.type, is_available: menu.is_available, has_sizes: true, sizes };
            }

            const recipes = menu.recipes as RecipeLine[];
            const price   = menu.unit_price ?? 0;
            return {
                id          : menu.id,
                code        : menu.code,
                name        : menu.name,
                type        : menu.type,
                is_available: menu.is_available,
                has_sizes   : false,
                status      : this._recipeStatus(recipes, ingredientMap, menu.is_available),
                price,
                can_produce : this._canProduce(recipes, ingredientMap),
                ...this._calcMetrics(recipes, ingredientMap, price),
            };
        });
    }

    async getMenuCostDetail(menu_id: number): Promise<MenuCostResult> {
        const menu = await Menu.findByPk(menu_id, {
            include: [
                { model: MenuType, attributes: ['id', 'name'] },
                MenuSize,
            ],
        });
        if (!menu) throw new NotFoundException('Menu not found.');

        const ingredientMap = await this._loadIngredientMap();

        if (menu.has_sizes) {
            const sizes: SizeResult[] = (menu.sizes ?? []).map(s => ({
                size        : s.size,
                price       : s.price,
                status      : this._recipeStatus(s.recipes, ingredientMap, menu.is_available),
                can_produce : this._canProduce(s.recipes, ingredientMap),
                ingredients : this._buildLines(s.recipes, ingredientMap),
                ...this._calcMetrics(s.recipes, ingredientMap, s.price),
            }));
            return { id: menu.id, code: menu.code, name: menu.name, type: menu.type, is_available: menu.is_available, has_sizes: true, sizes };
        }

        const recipes = menu.recipes as RecipeLine[];
        const price   = menu.unit_price ?? 0;
        return {
            id          : menu.id,
            code        : menu.code,
            name        : menu.name,
            type        : menu.type,
            is_available: menu.is_available,
            has_sizes   : false,
            status      : this._recipeStatus(recipes, ingredientMap, menu.is_available),
            price,
            can_produce : this._canProduce(recipes, ingredientMap),
            ingredients : this._buildLines(recipes, ingredientMap),
            ...this._calcMetrics(recipes, ingredientMap, price),
        };
    }

    async getCostSummary() {
        const menus = await this.getMenusWithCost();

        let complete = 0, missingRecipe = 0, missingCost = 0, inactive = 0;
        const pricedItems: { name: string; cost: number; margin_pct: number; food_cost_pct: number }[] = [];

        for (const m of menus) {
            if (m.has_sizes) {
                for (const s of m.sizes ?? []) {
                    this._tallyStatus(s.status, () => complete++, () => missingRecipe++, () => missingCost++, () => inactive++);
                    if ((s.price ?? 0) > 0) {
                        pricedItems.push({ name: `${m.name} (${s.size})`, cost: s.cost, margin_pct: s.margin_pct, food_cost_pct: s.food_cost_pct });
                    }
                }
            } else {
                this._tallyStatus(m.status!, () => complete++, () => missingRecipe++, () => missingCost++, () => inactive++);
                if ((m.price ?? 0) > 0) {
                    pricedItems.push({ name: m.name, cost: m.cost!, margin_pct: m.margin_pct!, food_cost_pct: m.food_cost_pct! });
                }
            }
        }

        const sorted         = [...pricedItems].sort((a, b) => b.margin_pct - a.margin_pct);
        const avg            = (arr: number[]) => arr.length ? this._round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;
        const avgMarginPct   = avg(pricedItems.map(m => m.margin_pct));
        const avgFoodCostPct = avg(pricedItems.map(m => m.food_cost_pct));

        return {
            total_products          : menus.length,
            recipes_complete        : complete,
            missing_recipes         : missingRecipe,
            missing_ingredient_costs: missingCost,
            inactive,
            avg_food_cost_pct       : avgFoodCostPct,
            avg_margin_pct          : avgMarginPct,
            highest_margin          : sorted.length ? { menu_name: sorted[0].name, margin_pct: sorted[0].margin_pct } : null,
            lowest_margin           : sorted.length ? { menu_name: sorted[sorted.length - 1].name, margin_pct: sorted[sorted.length - 1].margin_pct } : null,
        };
    }

    async cloneRecipe(source_id: number, target_id: number) {
        if (source_id === target_id) throw new BadRequestException('Source and target must be different menus.');

        const [source, target] = await Promise.all([
            Menu.findByPk(source_id, { include: [MenuSize] }),
            Menu.findByPk(target_id, { include: [MenuSize] }),
        ]);
        if (!source) throw new NotFoundException(`Source menu ${source_id} not found.`);
        if (!target) throw new NotFoundException(`Target menu ${target_id} not found.`);
        if (source.has_sizes !== target.has_sizes) {
            throw new BadRequestException('Source and target must both use sizes or both not use sizes.');
        }

        if (source.has_sizes) {
            for (const srcSize of source.sizes ?? []) {
                const tgtSize = (target.sizes ?? []).find(s => s.size === srcSize.size);
                if (tgtSize) await tgtSize.update({ recipes: srcSize.recipes });
            }
        } else {
            await target.update({ recipes: source.recipes });
        }

        return { message: 'Recipe cloned successfully.', source_id, target_id };
    }

    async snapshotCosts() {
        const menus = await this.getMenusWithCost();
        const rows: { menu_id: number; size: string | null; cost: number }[] = [];

        for (const m of menus) {
            if (m.has_sizes) {
                for (const s of m.sizes ?? []) rows.push({ menu_id: m.id, size: s.size, cost: s.cost });
            } else {
                rows.push({ menu_id: m.id, size: null, cost: m.cost ?? 0 });
            }
        }

        if (rows.length) {
            const values = rows.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(', ');
            const params = rows.flatMap(r => [r.menu_id, r.size, r.cost]);
            await this.sequelize.query(
                `INSERT INTO erp_recipe_cost_history (menu_id, size, cost) VALUES ${values}`,
                { bind: params },
            );
        }

        return { message: `Snapshot recorded for ${rows.length} items.` };
    }

    async getCostHistory(menu_id: number) {
        const menu = await Menu.findByPk(menu_id, { attributes: ['id', 'name', 'has_sizes'] });
        if (!menu) throw new NotFoundException('Menu not found.');

        const [rows] = await this.sequelize.query(
            `SELECT size, cost, recorded_at
             FROM erp_recipe_cost_history
             WHERE menu_id = $1
             ORDER BY recorded_at ASC`,
            { bind: [menu_id] },
        );

        return { menu_id, menu_name: menu.name, history: rows };
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private async _loadIngredientMap(): Promise<Map<number, MenuIngredient>> {
        const all = await MenuIngredient.findAll({
            attributes: ['id', 'name', 'unit', 'unit_cost', 'quantity'],
        });
        return new Map(all.map(i => [i.id, i]));
    }

    private _recipeStatus(
        recipes: RecipeLine[],
        ingredientMap: Map<number, MenuIngredient>,
        is_available: boolean,
    ): RecipeStatus {
        if (!is_available) return 'inactive';
        if (!Array.isArray(recipes) || recipes.length === 0) return 'missing_recipe';
        const hasMissingCost = recipes.some(r => {
            const ing = ingredientMap.get(r.ingredient_id);
            return !ing || Number(ing.unit_cost) === 0;
        });
        return hasMissingCost ? 'missing_cost' : 'complete';
    }

    private _calcMetrics(
        recipes: RecipeLine[],
        ingredientMap: Map<number, MenuIngredient>,
        price: number,
    ): CostMetrics {
        const cost = this._calcCost(recipes, ingredientMap);
        const p    = Number(price) || 0;
        return {
            cost,
            profit        : this._round(p - cost),
            food_cost_pct : p > 0 ? this._round((cost / p) * 100) : 0,
            margin_pct    : p > 0 ? this._round(((p - cost) / p) * 100) : 0,
        };
    }

    private _calcCost(recipes: RecipeLine[], ingredientMap: Map<number, MenuIngredient>): number {
        if (!Array.isArray(recipes)) return 0;
        return this._round(
            recipes.reduce((sum, line) => {
                const ing = ingredientMap.get(line.ingredient_id);
                return sum + Number(line.quantity) * (ing ? Number(ing.unit_cost) : 0);
            }, 0),
        );
    }

    private _canProduce(recipes: RecipeLine[], ingredientMap: Map<number, MenuIngredient>): number {
        if (!Array.isArray(recipes) || recipes.length === 0) return 0;
        const caps = recipes.map(r => {
            const ing = ingredientMap.get(r.ingredient_id);
            if (!ing || Number(r.quantity) <= 0) return 0;
            return Math.floor(Number(ing.quantity) / Number(r.quantity));
        });
        return Math.min(...caps);
    }

    private _buildLines(recipes: RecipeLine[], ingredientMap: Map<number, MenuIngredient>): IngredientCostLine[] {
        if (!Array.isArray(recipes)) return [];
        return recipes.map(line => {
            const ing   = ingredientMap.get(line.ingredient_id);
            const uc    = ing ? Number(ing.unit_cost) : 0;
            const stock = ing ? Number(ing.quantity)  : 0;
            const qty   = Number(line.quantity);
            return {
                ingredient_id        : line.ingredient_id,
                ingredient_name      : ing?.name ?? 'Unknown',
                unit                 : ing?.unit ?? '',
                quantity             : qty,
                unit_cost            : uc,
                line_cost            : this._round(qty * uc),
                stock_on_hand        : stock,
                can_produce_from_this: qty > 0 ? Math.floor(stock / qty) : 0,
            };
        });
    }

    private _tallyStatus(
        status: RecipeStatus,
        onComplete: () => void,
        onMissingRecipe: () => void,
        onMissingCost: () => void,
        onInactive: () => void,
    ) {
        if      (status === 'complete')       onComplete();
        else if (status === 'missing_recipe') onMissingRecipe();
        else if (status === 'missing_cost')   onMissingCost();
        else                                  onInactive();
    }

    private _overallStatus(statuses: RecipeStatus[]): RecipeStatus {
        if (statuses.every(s => s === 'inactive'))    return 'inactive';
        if (statuses.some(s => s === 'missing_recipe')) return 'missing_recipe';
        if (statuses.some(s => s === 'missing_cost'))   return 'missing_cost';
        return 'complete';
    }

    private _round(v: number, d = 2) { return parseFloat(v.toFixed(d)); }

    // ─── Frontend mappers ─────────────────────────────────────────────────────

    toFrontendListItem(m: MenuCostResult) {
        const base = {
            menu_id     : m.id,
            menu_code   : m.code,
            menu_name   : m.name,
            type        : m.type,
            is_available: m.is_available,
            has_sizes   : m.has_sizes,
        };
        if (m.has_sizes) {
            return {
                ...base,
                status: this._overallStatus((m.sizes ?? []).map(s => s.status)),
                sizes : (m.sizes ?? []).map(s => ({
                    size         : s.size,
                    price        : s.price,
                    cost         : s.cost,
                    profit       : s.profit,
                    food_cost_pct: s.food_cost_pct,
                    margin_pct   : s.margin_pct,
                    can_produce  : s.can_produce,
                    status       : s.status,
                })),
            };
        }
        return {
            ...base,
            status       : m.status,
            price        : m.price,
            cost         : m.cost,
            profit       : m.profit,
            food_cost_pct: m.food_cost_pct,
            margin_pct   : m.margin_pct,
            can_produce  : m.can_produce,
        };
    }

    toFrontendDetail(d: MenuCostResult) {
        const base = this.toFrontendListItem(d);
        if (d.has_sizes) {
            return {
                ...base,
                sizes: (d.sizes ?? []).map(s => ({
                    size         : s.size,
                    price        : s.price,
                    cost         : s.cost,
                    profit       : s.profit,
                    food_cost_pct: s.food_cost_pct,
                    margin_pct   : s.margin_pct,
                    can_produce  : s.can_produce,
                    status       : s.status,
                    ingredients  : (s.ingredients ?? []).map(i => this._mapIngredient(i)),
                })),
            };
        }
        return {
            ...base,
            ingredients: (d.ingredients ?? []).map(i => this._mapIngredient(i)),
        };
    }

    toFrontendSummary(s: ReturnType<RecipeCostingService['getCostSummary']> extends Promise<infer T> ? T : never) {
        return s;
    }

    private _mapIngredient(i: IngredientCostLine) {
        return {
            ingredient_id        : i.ingredient_id,
            name                 : i.ingredient_name,
            unit                 : i.unit,
            quantity_used        : i.quantity,
            unit_cost            : i.unit_cost,
            line_cost            : i.line_cost,
            stock_on_hand        : i.stock_on_hand,
            can_produce_from_this: i.can_produce_from_this,
        };
    }
}
