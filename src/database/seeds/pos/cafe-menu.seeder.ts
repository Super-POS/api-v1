import { Sequelize }            from 'sequelize-typescript';
import MenuIngredient         from '@app/models/menu/menu-ingredient.model';
import IngredientStockMovement, { StockMovementType } from '@app/models/menu/stock_movement.model';
import Menu                   from '@app/models/menu/menu.model';
import MenuType                from '@app/models/menu/menu-type.model';
import ModifierGroup          from '@app/models/menu/modifier-group.model';
import ModifierOption         from '@app/models/menu/modifier-option.model';
import MenuModifierGroup      from '@app/models/menu/menu-modifier-group.model';

// =========================================================================
// CLUB 54 — Coffee Manual measurements (seed catalogue)
// Espresso: 1 shot = 30 ml, 2 shots = 60 ml (extra shot +30 ml).
// Flavored syrup pumps: 10 ml per pump (12 oz / Medium = 2 pumps, 16 oz / Large = 3 pumps).
// Ice “1 cup” ≈ 150 g for stock deduction.
// Menu photos: reuse existing static paths where a visual match exists.
// =========================================================================

const TYPES = [
    { id: 1, name: 'CLUB 54 — Hot Beverages',      image: 'static/pos/products/type/coffee.jpg' },
    { id: 2, name: 'CLUB 54 — Chill Beverages',   image: 'static/pos/products/type/cold-brew.jpg' },
    { id: 3, name: 'CLUB 54 — Frappe',             image: 'static/pos/products/type/smoothie.jpg' },
    { id: 4, name: 'CLUB 54 — Soda',               image: 'static/pos/products/smoothie/strawberry.jpg' },
];

/** Prices in KHR — demo menu. */
const MENUS = [
    // ── Hot ─────────────────────────────────────────────────────────────
    { id:  1, code: 'C54-H01', type_id: 1, name: 'Single Espresso',           unit_price:  6000, discount: 0, image: 'static/pos/products/coffee/espresso.jpg',           creator_id: 1 },
    { id:  2, code: 'C54-H02', type_id: 1, name: 'Double Espresso',           unit_price:  9000, discount: 0, image: 'static/pos/products/coffee/espresso.jpg',           creator_id: 1 },
    { id:  3, code: 'C54-H03', type_id: 1, name: 'Hot Americano M (12 oz)',   unit_price: 10000, discount: 0, image: 'static/pos/products/coffee/americano.jpg',           creator_id: 1 },
    { id:  4, code: 'C54-H04', type_id: 1, name: 'Hot Americano L (16 oz)',   unit_price: 12000, discount: 0, image: 'static/pos/products/coffee/americano.jpg',           creator_id: 1 },
    { id:  5, code: 'C54-H05', type_id: 1, name: 'Hot Café Latte M (12 oz)',   unit_price: 14000, discount: 0, image: 'static/pos/products/coffee/latte.jpg',               creator_id: 1 },
    { id:  6, code: 'C54-H06', type_id: 1, name: 'Hot Café Latte L (16 oz)',   unit_price: 16000, discount: 0, image: 'static/pos/products/coffee/latte.jpg',               creator_id: 1 },
    { id:  7, code: 'C54-H07', type_id: 1, name: 'Hot Cappuccino M (12 oz)',   unit_price: 14000, discount: 0, image: 'static/pos/products/coffee/cappuccino.jpg',          creator_id: 1 },
    { id:  8, code: 'C54-H08', type_id: 1, name: 'Hot Cappuccino L (16 oz)',   unit_price: 16000, discount: 0, image: 'static/pos/products/coffee/cappuccino.jpg',          creator_id: 1 },
    { id:  9, code: 'C54-H09', type_id: 1, name: 'Hot Matcha Latte M (12 oz)', unit_price: 15000, discount: 0, image: 'static/pos/products/tea/matcha-latte.jpg',          creator_id: 1 },
    { id: 10, code: 'C54-H10', type_id: 1, name: 'Hot Matcha Latte L (16 oz)', unit_price: 17000, discount: 0, image: 'static/pos/products/tea/matcha-latte.jpg',          creator_id: 1 },
    // ── Iced ────────────────────────────────────────────────────────────
    { id: 11, code: 'C54-C01', type_id: 2, name: 'Iced Americano M',           unit_price: 11000, discount: 0, image: 'static/pos/products/cold/iced-americano.jpg',       creator_id: 1 },
    { id: 12, code: 'C54-C02', type_id: 2, name: 'Iced Americano L',           unit_price: 13000, discount: 0, image: 'static/pos/products/cold/iced-americano.jpg',       creator_id: 1 },
    { id: 13, code: 'C54-C03', type_id: 2, name: 'Iced Latte M',               unit_price: 15000, discount: 0, image: 'static/pos/products/cold/iced-latte.jpg',           creator_id: 1 },
    { id: 14, code: 'C54-C04', type_id: 2, name: 'Iced Latte L',               unit_price: 17000, discount: 0, image: 'static/pos/products/cold/iced-latte.jpg',           creator_id: 1 },
    { id: 15, code: 'C54-C05', type_id: 2, name: 'Iced Cappuccino M',          unit_price: 15000, discount: 0, image: 'static/pos/products/coffee/cappuccino.jpg',          creator_id: 1 },
    { id: 16, code: 'C54-C06', type_id: 2, name: 'Iced Cappuccino L',          unit_price: 17000, discount: 0, image: 'static/pos/products/coffee/cappuccino.jpg',          creator_id: 1 },
    { id: 17, code: 'C54-C07', type_id: 2, name: 'Iced Chocolate M',           unit_price: 15000, discount: 0, image: 'static/pos/products/coffee/mocha.jpg',               creator_id: 1 },
    { id: 18, code: 'C54-C08', type_id: 2, name: 'Iced Chocolate L',           unit_price: 17000, discount: 0, image: 'static/pos/products/coffee/mocha.jpg',               creator_id: 1 },
    { id: 19, code: 'C54-C09', type_id: 2, name: 'Iced Matcha Latte M',        unit_price: 16000, discount: 0, image: 'static/pos/products/cold/iced-matcha.jpg',          creator_id: 1 },
    { id: 20, code: 'C54-C10', type_id: 2, name: 'Iced Matcha Latte L',        unit_price: 18000, discount: 0, image: 'static/pos/products/cold/iced-matcha.jpg',          creator_id: 1 },
    // ── Frappe ───────────────────────────────────────────────────────────
    { id: 21, code: 'C54-F01', type_id: 3, name: 'Café Frappe M',              unit_price: 16000, discount: 0, image: 'static/pos/products/cold/iced-latte.jpg',           creator_id: 1 },
    { id: 22, code: 'C54-F02', type_id: 3, name: 'Café Frappe L',              unit_price: 18000, discount: 0, image: 'static/pos/products/cold/iced-latte.jpg',           creator_id: 1 },
    { id: 23, code: 'C54-F03', type_id: 3, name: 'Chocolate Frappe M',         unit_price: 16000, discount: 0, image: 'static/pos/products/coffee/mocha.jpg',               creator_id: 1 },
    { id: 24, code: 'C54-F04', type_id: 3, name: 'Chocolate Frappe L',         unit_price: 18000, discount: 0, image: 'static/pos/products/coffee/mocha.jpg',               creator_id: 1 },
    { id: 25, code: 'C54-F05', type_id: 3, name: 'Matcha Frappe M',            unit_price: 17000, discount: 0, image: 'static/pos/products/cold/iced-matcha.jpg',          creator_id: 1 },
    { id: 26, code: 'C54-F06', type_id: 3, name: 'Matcha Frappe L',            unit_price: 19000, discount: 0, image: 'static/pos/products/cold/iced-matcha.jpg',          creator_id: 1 },
    { id: 27, code: 'C54-F07', type_id: 3, name: 'Strawberry Frappe M',        unit_price: 15000, discount: 0, image: 'static/pos/products/smoothie/strawberry.jpg',       creator_id: 1 },
    { id: 28, code: 'C54-F08', type_id: 3, name: 'Strawberry Frappe L',        unit_price: 17000, discount: 0, image: 'static/pos/products/smoothie/strawberry.jpg',       creator_id: 1 },
    { id: 29, code: 'C54-F09', type_id: 3, name: 'Mango Frappe M',             unit_price: 15000, discount: 0, image: 'static/pos/products/smoothie/mango.jpg',             creator_id: 1 },
    { id: 30, code: 'C54-F10', type_id: 3, name: 'Mango Frappe L',             unit_price: 17000, discount: 0, image: 'static/pos/products/smoothie/mango.jpg',             creator_id: 1 },
    // ── Soda ─────────────────────────────────────────────────────────────
    { id: 31, code: 'C54-S01', type_id: 4, name: 'Strawberry Soda M',            unit_price: 12000, discount: 0, image: 'static/pos/products/smoothie/strawberry.jpg',       creator_id: 1 },
    { id: 32, code: 'C54-S02', type_id: 4, name: 'Strawberry Soda L',            unit_price: 14000, discount: 0, image: 'static/pos/products/smoothie/strawberry.jpg',       creator_id: 1 },
    { id: 33, code: 'C54-S03', type_id: 4, name: 'Peach Soda M',                unit_price: 12000, discount: 0, image: 'static/pos/products/smoothie/orange-juice.jpg',      creator_id: 1 },
    { id: 34, code: 'C54-S04', type_id: 4, name: 'Peach Soda L',                unit_price: 14000, discount: 0, image: 'static/pos/products/smoothie/orange-juice.jpg',      creator_id: 1 },
];

/**
 * unit_cost = cost per base unit (ml / g / pcs / shot).
 * IDs 1–5 align with modifier options (espresso / milk / sugar syrup / ice).
 */
const INGREDIENTS = [
    { id:  1, name: 'Espresso Shot',       unit: 'shot', quantity: 800,    unit_cost: 0.30  },
    { id:  2, name: 'Fresh Milk',          unit: 'ml',   quantity: 25000,  unit_cost: 0.005 },
    { id:  3, name: 'Hot Water',           unit: 'ml',   quantity: 50000,  unit_cost: 0.0001 },
    { id:  4, name: 'Sugar Syrup',         unit: 'ml',   quantity: 8000,   unit_cost: 0.002 },
    { id:  5, name: 'Ice',                 unit: 'g',    quantity: 60000,  unit_cost: 0.0005 },
    { id:  6, name: 'Sugar Packet',        unit: 'pcs',  quantity: 2000,   unit_cost: 0.03  },
    { id:  7, name: 'Chocolate Powder',    unit: 'g',    quantity: 3000,   unit_cost: 0.02  },
    { id:  8, name: 'Matcha Powder',       unit: 'g',    quantity: 1500,   unit_cost: 0.05  },
    { id:  9, name: 'Chocolate Sauce',     unit: 'g',    quantity: 5000,   unit_cost: 0.015 },
    { id: 10, name: 'Vanilla Powder',      unit: 'g',    quantity: 2000,   unit_cost: 0.04  },
    { id: 11, name: 'Frappe Powder',       unit: 'g',    quantity: 2000,   unit_cost: 0.035 },
    { id: 12, name: 'Strawberry Puree',    unit: 'g',    quantity: 4000,   unit_cost: 0.018 },
    { id: 13, name: 'Smoothie Powder',     unit: 'g',    quantity: 2000,   unit_cost: 0.025 },
    { id: 14, name: 'Lemonade Syrup',      unit: 'ml',   quantity: 3000,   unit_cost: 0.008 },
    { id: 15, name: 'Mango Puree',         unit: 'g',    quantity: 4000,   unit_cost: 0.015 },
    { id: 16, name: 'Strawberry Syrup',    unit: 'ml',   quantity: 4000,   unit_cost: 0.012 },
    { id: 17, name: 'Peach Syrup',         unit: 'ml',   quantity: 4000,   unit_cost: 0.012 },
    { id: 18, name: 'Soda Water',          unit: 'ml',   quantity: 30000,  unit_cost: 0.002 },
    { id: 19, name: 'Lime Juice',          unit: 'ml',   quantity: 2000,   unit_cost: 0.01  },
    { id: 20, name: 'Cool Water',          unit: 'ml',   quantity: 50000,  unit_cost: 0.0001 },
    { id: 21, name: 'Oat Milk',            unit: 'ml',   quantity: 10000,  unit_cost: 0.008 },
];

// [menu_id, ingredient_id, quantity_per_serving]
const RECIPES: [number, number, number][] = [
    [1, 1, 1],
    [2, 1, 2],
    [3, 1, 1], [3, 3, 290], [3, 6, 1],
    [4, 1, 2], [4, 3, 320], [4, 6, 1],
    [5, 1, 1], [5, 2, 280], [5, 6, 1],
    [6, 1, 2], [6, 2, 320], [6, 6, 1],
    [7, 1, 1], [7, 2, 280], [7, 7, 3], [7, 6, 1],
    [8, 1, 2], [8, 2, 320], [8, 7, 3], [8, 6, 1],
    [9, 8, 4], [9, 3, 60], [9, 2, 280], [9, 6, 1],
    [10, 8, 6], [10, 3, 60], [10, 2, 320], [10, 6, 1],
    [11, 1, 2], [11, 20, 100], [11, 5, 150],
    [12, 1, 3], [12, 20, 150], [12, 5, 150],
    [13, 1, 2], [13, 2, 100], [13, 5, 150],
    [14, 1, 3], [14, 2, 140], [14, 5, 150],
    [15, 1, 2], [15, 2, 100], [15, 7, 3], [15, 5, 150],
    [16, 1, 3], [16, 2, 140], [16, 7, 5], [16, 5, 150],
    [17, 9, 30], [17, 2, 130], [17, 5, 150],
    [18, 9, 45], [18, 2, 150], [18, 5, 150],
    [19, 8, 4], [19, 2, 120], [19, 5, 150],
    [20, 8, 6], [20, 2, 150], [20, 5, 150],
    [21, 1, 2], [21, 2, 100], [21, 10, 5], [21, 7, 3], [21, 5, 150],
    [22, 1, 3], [22, 2, 120], [22, 10, 5], [22, 7, 3], [22, 5, 150],
    [23, 9, 30], [23, 2, 100], [23, 10, 5], [23, 7, 3], [23, 5, 150],
    [24, 9, 45], [24, 2, 120], [24, 10, 5], [24, 7, 3], [24, 5, 150],
    [25, 8, 4], [25, 11, 5], [25, 2, 100], [25, 8, 2], [25, 5, 150],
    [26, 8, 6], [26, 11, 5], [26, 2, 120], [26, 8, 2], [26, 5, 150],
    [27, 12, 20], [27, 20, 80], [27, 13, 10], [27, 14, 10], [27, 5, 150],
    [28, 12, 30], [28, 20, 100], [28, 13, 10], [28, 14, 10], [28, 5, 150],
    [29, 15, 20], [29, 20, 80], [29, 13, 10], [29, 14, 10], [29, 5, 150],
    [30, 15, 30], [30, 20, 100], [30, 13, 10], [30, 14, 10], [30, 5, 150],
    [31, 16, 20], [31, 18, 120], [31, 19, 5], [31, 4, 10], [31, 5, 150],
    [32, 16, 30], [32, 18, 150], [32, 19, 5], [32, 4, 10], [32, 5, 150],
    [33, 17, 20], [33, 18, 120], [33, 14, 5], [33, 4, 10], [33, 5, 150],
    [34, 17, 30], [34, 18, 150], [34, 14, 5], [34, 4, 10], [34, 5, 150],
];

export class CafeMenuSeeder {

    public static async seed(): Promise<void> {
        try {
            await CafeMenuSeeder._seedTypes();
            await CafeMenuSeeder._seedIngredients();
            await CafeMenuSeeder._seedMenus();
            await CafeMenuSeeder._seedModifiers();
            await CafeMenuSeeder._syncPostgresIdSequences();
            await CafeMenuSeeder._seedInitialStock();
        } catch (err) {
            console.error('\x1b[31mError in CafeMenuSeeder:', err.message);
            throw err;
        }
    }

    private static async _seedTypes() {
        await MenuType.bulkCreate(TYPES);
        console.log('\x1b[32m✔  Menu types inserted (%d rows)', TYPES.length);
    }

    private static async _seedIngredients() {
        await MenuIngredient.bulkCreate(INGREDIENTS);
        console.log('\x1b[32m✔  Ingredients inserted (%d rows)', INGREDIENTS.length);
    }

    private static async _seedMenus() {
        const recipeByMenuId = new Map<number, { ingredient_id: number; quantity: number }[]>();
        for (const [menuId, ingredient_id, quantity] of RECIPES) {
            if (!recipeByMenuId.has(menuId)) {
                recipeByMenuId.set(menuId, []);
            }
            recipeByMenuId.get(menuId)!.push({ ingredient_id, quantity });
        }
        const rows = MENUS.map((m) => ({
            ...m,
            recipes: recipeByMenuId.get(m.id) ?? [],
        }));
        await Menu.bulkCreate(rows as any);
        console.log('\x1b[32m✔  Menus inserted (%d rows)', rows.length);
    }

    /** Sugar / ice / milk on iced espresso drinks & iced latte lines. */
    private static async _seedModifiers() {
        await ModifierGroup.bulkCreate([
            { id: 1, name: 'Sugar level', code: 'sugar', sort_order: 0, is_active: true },
            { id: 2, name: 'Ice',         code: 'ice',  sort_order: 1, is_active: true },
            { id: 3, name: 'Milk',        code: 'milk', sort_order: 2, is_active: true },
        ] as any);
        await ModifierOption.bulkCreate([
            { id: 1, group_id: 1, label: '0%', code: 's0', price_delta: 0, is_active: true, is_default: true, ingredient_recipe: [] },
            { id: 2, group_id: 1, label: '30%', code: 's30', price_delta: 0, is_active: true, is_default: false, ingredient_recipe: [{ ingredient_id: 4, quantity: 5 }] },
            { id: 3, group_id: 1, label: '50%', code: 's50', price_delta: 0, is_active: true, is_default: false, ingredient_recipe: [{ ingredient_id: 4, quantity: 10 }] },
            { id: 4, group_id: 1, label: '70%', code: 's70', price_delta: 0, is_active: true, is_default: false, ingredient_recipe: [{ ingredient_id: 4, quantity: 15 }] },
            { id: 5, group_id: 1, label: '100%', code: 's100', price_delta: 0, is_active: true, is_default: false, ingredient_recipe: [{ ingredient_id: 4, quantity: 20 }] },
            { id: 6, group_id: 2, label: 'No ice', code: 'i0', price_delta: 0, is_active: true, is_default: false, ingredient_recipe: [] },
            { id: 7, group_id: 2, label: 'Less ice', code: 'i_less', price_delta: 0, is_active: true, is_default: false, ingredient_recipe: [{ ingredient_id: 5, quantity: 80 }] },
            { id: 8, group_id: 2, label: 'Regular', code: 'i_reg', price_delta: 0, is_active: true, is_default: true, ingredient_recipe: [{ ingredient_id: 5, quantity: 150 }] },
            { id: 9, group_id: 2, label: 'Extra ice', code: 'i_x', price_delta: 0, is_active: true, is_default: false, ingredient_recipe: [{ ingredient_id: 5, quantity: 200 }] },
            { id: 10, group_id: 3, label: 'Fresh dairy', code: 'm_cow', price_delta: 0, is_active: true, is_default: true, ingredient_recipe: [{ ingredient_id: 2, quantity: 180 }] },
            { id: 11, group_id: 3, label: 'Oat', code: 'm_oat', price_delta: 2000, is_active: true, is_default: false, ingredient_recipe: [{ ingredient_id: 21, quantity: 180 }] },
            { id: 12, group_id: 3, label: 'Almond', code: 'm_alm', price_delta: 2000, is_active: true, is_default: false, ingredient_recipe: [{ ingredient_id: 2, quantity: 180 }] },
            { id: 13, group_id: 3, label: 'Soy', code: 'm_soy', price_delta: 1500, is_active: true, is_default: false, ingredient_recipe: [{ ingredient_id: 2, quantity: 180 }] },
        ] as any);
        await MenuModifierGroup.bulkCreate([
            { menu_id: 13, modifier_group_id: 1, sort_order: 0, is_required: true },
            { menu_id: 13, modifier_group_id: 2, sort_order: 1, is_required: true },
            { menu_id: 14, modifier_group_id: 1, sort_order: 0, is_required: true },
            { menu_id: 14, modifier_group_id: 2, sort_order: 1, is_required: true },
            { menu_id: 15, modifier_group_id: 1, sort_order: 0, is_required: true },
            { menu_id: 15, modifier_group_id: 2, sort_order: 1, is_required: true },
            { menu_id: 16, modifier_group_id: 1, sort_order: 0, is_required: true },
            { menu_id: 16, modifier_group_id: 2, sort_order: 1, is_required: true },
            { menu_id: 11, modifier_group_id: 1, sort_order: 0, is_required: true },
            { menu_id: 11, modifier_group_id: 2, sort_order: 1, is_required: true },
            { menu_id: 12, modifier_group_id: 1, sort_order: 0, is_required: true },
            { menu_id: 12, modifier_group_id: 2, sort_order: 1, is_required: true },
            { menu_id: 19, modifier_group_id: 1, sort_order: 0, is_required: true },
            { menu_id: 19, modifier_group_id: 2, sort_order: 1, is_required: true },
            { menu_id: 20, modifier_group_id: 1, sort_order: 0, is_required: true },
            { menu_id: 20, modifier_group_id: 2, sort_order: 1, is_required: true },
        ] as any);
        console.log('\x1b[32m✔  Modifier groups, options, and menu links inserted');
    }

    private static async _syncPostgresIdSequences(): Promise<void> {
        const seq = (Menu as unknown as { sequelize: Sequelize | undefined }).sequelize;
        if (!seq || seq.getDialect() !== 'postgres') {
            return;
        }
        for (const table of ['menu_types', 'menu_ingredients', 'menus', 'modifier_groups', 'modifier_options'] as const) {
            await seq.query(
                `SELECT setval(
  pg_get_serial_sequence('${table}', 'id'),
  COALESCE((SELECT MAX(id) FROM ${table}), 0),
  true
);`
            );
        }
    }

    private static async _seedInitialStock() {
        const rows = INGREDIENTS.map(ing => ({
            ingredient_id: ing.id,
            type         : StockMovementType.IN,
            quantity     : ing.quantity,
            note         : 'Initial opening stock',
            created_by   : 1,
            created_at   : daysAgo(90),
        }));
        await IngredientStockMovement.bulkCreate(rows);
        console.log('\x1b[32m✔  Initial stock movements inserted (%d rows)', rows.length);
    }
}

function daysAgo(n: number, hourOffset = 0): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(hourOffset, 0, 0, 0);
    return d;
}
