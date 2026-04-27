import { Sequelize }            from 'sequelize-typescript';
import MenuIngredient         from '@app/models/menu/menu-ingredient.model';
import IngredientStockMovement, { StockMovementType } from '@app/models/menu/stock_movement.model';
import Menu                   from '@app/models/menu/menu.model';
import MenuType                from '@app/models/menu/menu-type.model';
import ModifierGroup          from '@app/models/menu/modifier-group.model';
import ModifierOption         from '@app/models/menu/modifier-option.model';
import MenuModifierGroup      from '@app/models/menu/menu-modifier-group.model';

// =========================================================================
// Catalogue data
// Menu photos live under `file-v1/public/…` and were sourced from
// Pexels & Unsplash (royalty-free for commercial use). See each site’s license.
// =========================================================================

const TYPES = [
    { id: 1, name: 'Artisan Hot Coffee',     image: 'static/pos/products/type/coffee.jpg'     },
    { id: 2, name: 'Tea & Lattes',            image: 'static/pos/products/type/tea.jpg'         },
    { id: 3, name: 'Cold Brew & Iced',        image: 'static/pos/products/type/cold-brew.jpg'  },
    { id: 4, name: 'Bakery & Plates',         image: 'static/pos/products/type/pastry.jpg'      },
    { id: 5, name: 'Coolers & Fresh Juice',   image: 'static/pos/products/type/smoothie.jpg'  },
];

/** Prices in Riel (៛) — photo-ready demo menu. */
const MENUS = [
    // ── Hot coffee (single origin beans, 9-bar extraction) ───────────────
    { id:  1, code: 'CF-001', type_id: 1, name: 'Doppio Espresso (30 ml)',   unit_price:  6000, discount: 0, image: 'static/pos/products/coffee/espresso.jpg',         creator_id: 1 },
    { id:  2, code: 'CF-002', type_id: 1, name: 'Long Black',                unit_price:  9000, discount: 0, image: 'static/pos/products/coffee/americano.jpg',        creator_id: 1 },
    { id:  3, code: 'CF-003', type_id: 1, name: 'Signature Café Latte',     unit_price: 14000, discount: 0, image: 'static/pos/products/coffee/latte.jpg',            creator_id: 1 },
    { id:  4, code: 'CF-004', type_id: 1, name: 'Cappuccino (Traditional)',  unit_price: 14000, discount: 0, image: 'static/pos/products/coffee/cappuccino.jpg',       creator_id: 1 },
    { id:  5, code: 'CF-005', type_id: 1, name: 'Flat White',                unit_price: 15000, discount: 0, image: 'static/pos/products/coffee/flatwhite.jpg',         creator_id: 1 },
    { id:  6, code: 'CF-006', type_id: 1, name: 'Caramel Macchiato',         unit_price: 16000, discount: 0, image: 'static/pos/products/coffee/macchiato.jpg',         creator_id: 1 },
    { id:  7, code: 'CF-007', type_id: 1, name: 'Café Mocha',                unit_price: 15000, discount: 0, image: 'static/pos/products/coffee/mocha.jpg',             creator_id: 1 },
    { id:  8, code: 'CF-008', type_id: 1, name: 'Dirty Matcha Latte (Hot)',  unit_price: 18000, discount: 0, image: 'static/pos/products/coffee/dirty-matcha.jpg',     creator_id: 1 },
    // ── Tea & lattes ──────────────────────────────────────────────────────
    { id:  9, code: 'NC-001', type_id: 2, name: 'Uji Matcha Latte',          unit_price: 15000, discount: 0, image: 'static/pos/products/tea/matcha-latte.jpg',         creator_id: 1 },
    { id: 10, code: 'NC-002', type_id: 2, name: 'Cha Yen (Thai Milk Tea)',  unit_price: 12000, discount: 0, image: 'static/pos/products/tea/thai-tea.jpg',             creator_id: 1 },
    { id: 11, code: 'NC-003', type_id: 2, name: 'Chamomile (Pot)',           unit_price:  8000, discount: 0, image: 'static/pos/products/tea/chamomile.jpg',            creator_id: 1 },
    { id: 12, code: 'NC-004', type_id: 2, name: 'Taro Velvet Latte',         unit_price: 15000, discount: 0, image: 'static/pos/products/tea/taro.jpg',                 creator_id: 1 },
    // ── Iced & cold brew ──────────────────────────────────────────────────
    { id: 13, code: 'CB-001', type_id: 3, name: '18h Nitro-Style Cold Brew', unit_price: 15000, discount: 0, image: 'static/pos/products/cold/cold-brew.jpg',           creator_id: 1 },
    { id: 14, code: 'CB-002', type_id: 3, name: 'Iced Long Black',           unit_price: 10000, discount: 0, image: 'static/pos/products/cold/iced-americano.jpg',     creator_id: 1 },
    { id: 15, code: 'CB-003', type_id: 3, name: 'Iced Signature Latte',      unit_price: 15000, discount: 0, image: 'static/pos/products/cold/iced-latte.jpg',         creator_id: 1 },
    { id: 16, code: 'CB-004', type_id: 3, name: 'Iced Matcha Latte',         unit_price: 16000, discount: 0, image: 'static/pos/products/cold/iced-matcha.jpg',         creator_id: 1 },
    { id: 17, code: 'CB-005', type_id: 3, name: 'Brown-Sugar Iced Latte',    unit_price: 18000, discount: 0, image: 'static/pos/products/cold/brown-sugar-latte.jpg',   creator_id: 1 },
    // ── Bakery ────────────────────────────────────────────────────────────
    { id: 18, code: 'FP-001', type_id: 4, name: 'All-Butter Croissant',     unit_price:  7000, discount: 0, image: 'static/pos/products/food/croissant.jpg',           creator_id: 1 },
    { id: 19, code: 'FP-002', type_id: 4, name: 'New York Baked Cheesecake',  unit_price: 15000, discount: 0, image: 'static/pos/products/food/cheesecake.jpg',         creator_id: 1 },
    { id: 20, code: 'FP-003', type_id: 4, name: 'Caramel Banana Loaf',      unit_price:  5000, discount: 0, image: 'static/pos/products/food/banana-bread.jpg',         creator_id: 1 },
    { id: 21, code: 'FP-004', type_id: 4, name: 'Double-Chocolate Muffin',  unit_price:  7000, discount: 0, image: 'static/pos/products/food/muffin.jpg',              creator_id: 1 },
    { id: 22, code: 'FP-005', type_id: 4, name: 'Smashed Avo & Feta Sourdough', unit_price: 20000, discount: 0, image: 'static/pos/products/food/avocado-toast.jpg',     creator_id: 1 },
    // ── Coolers & juice ───────────────────────────────────────────────────
    { id: 23, code: 'SJ-001', type_id: 5, name: 'Wild Berry Smoothie',      unit_price: 15000, discount: 0, image: 'static/pos/products/smoothie/strawberry.jpg',      creator_id: 1 },
    { id: 24, code: 'SJ-002', type_id: 5, name: 'Alphonso Mango Cooler',     unit_price: 15000, discount: 0, image: 'static/pos/products/smoothie/mango.jpg',           creator_id: 1 },
    { id: 25, code: 'SJ-003', type_id: 5, name: 'Fresh-Pressed Orange',      unit_price: 12000, discount: 0, image: 'static/pos/products/smoothie/orange-juice.jpg',      creator_id: 1 },
];

// unit_cost = cost per base unit (ml / g / pcs)
const INGREDIENTS = [
    { id:  1, name: 'Espresso Shot',        unit: 'shot', quantity: 500,   unit_cost: 0.30   }, // per shot
    { id:  2, name: 'Fresh Milk',           unit: 'ml',   quantity: 20000, unit_cost: 0.005  },
    { id:  3, name: 'Oat Milk',             unit: 'ml',   quantity: 10000, unit_cost: 0.008  },
    { id:  4, name: 'Sugar Syrup',          unit: 'ml',   quantity: 5000,  unit_cost: 0.002  },
    { id:  5, name: 'Ice',                  unit: 'g',    quantity: 50000, unit_cost: 0.0005 },
    { id:  6, name: 'Caramel Syrup',        unit: 'ml',   quantity: 3000,  unit_cost: 0.010  },
    { id:  7, name: 'Chocolate Sauce',      unit: 'ml',   quantity: 3000,  unit_cost: 0.012  },
    { id:  8, name: 'Vanilla Syrup',        unit: 'ml',   quantity: 3000,  unit_cost: 0.009  },
    { id:  9, name: 'Matcha Powder',        unit: 'g',    quantity: 1000,  unit_cost: 0.05   },
    { id: 10, name: 'Whipping Cream',       unit: 'ml',   quantity: 5000,  unit_cost: 0.007  },
    { id: 11, name: 'Tea Bag',              unit: 'pcs',  quantity: 500,   unit_cost: 0.05   },
    { id: 12, name: 'Brown Sugar',          unit: 'g',    quantity: 3000,  unit_cost: 0.003  },
    { id: 13, name: 'Taro Powder',          unit: 'g',    quantity: 2000,  unit_cost: 0.04   },
    { id: 14, name: 'Cold Brew Concentrate',unit: 'ml',   quantity: 10000, unit_cost: 0.020  },
    { id: 15, name: 'Strawberry Puree',     unit: 'ml',   quantity: 5000,  unit_cost: 0.015  },
    { id: 16, name: 'Mango Puree',          unit: 'ml',   quantity: 5000,  unit_cost: 0.012  },
    { id: 17, name: 'Fresh Orange',         unit: 'g',    quantity: 10000, unit_cost: 0.003  },
];

// [menu_id, ingredient_id, quantity_per_serving]
const RECIPES: [number, number, number][] = [
    // Espresso (1): 1 shot
    [1,  1, 1],
    // Americano (2): 1 shot
    [2,  1, 1],
    // Signature Café Latte (3): espresso only here; milk comes from modifier option (milk group) for correct stock
    [3,  1, 1],
    // Cappuccino (4): 1 shot + 120ml milk + 30ml whipping cream
    [4,  1, 1], [4,  2, 120], [4, 10, 30],
    // Flat White (5): 1 shot + 160ml milk
    [5,  1, 1], [5,  2, 160],
    // Caramel Macchiato (6): 1 shot + 180ml milk + 20ml caramel
    [6,  1, 1], [6,  2, 180], [6,  6, 20],
    // Mocha (7): 1 shot + 160ml milk + 20ml chocolate
    [7,  1, 1], [7,  2, 160], [7,  7, 20],
    // Dirty Matcha (8): 1 shot + 5g matcha + 180ml oat milk
    [8,  1, 1], [8,  9, 5],   [8,  3, 180],
    // Matcha Latte (9): 5g matcha + 180ml oat milk
    [9,  9, 5], [9,  3, 180],
    // Thai Milk Tea (10): 1 tea bag + 180ml milk + 20ml sugar syrup
    [10, 11, 1], [10, 2, 180], [10, 4, 20],
    // Chamomile Tea (11): 1 tea bag
    [11, 11, 1],
    // Taro Milk Tea (12): 20g taro powder + 180ml milk + 10ml sugar syrup
    [12, 13, 20], [12, 2, 180], [12, 4, 10],
    // Cold Brew Classic (13): 120ml concentrate + 200g ice
    [13, 14, 120], [13, 5, 200],
    // Iced Americano (14): 1 shot + 200g ice
    [14,  1, 1], [14,  5, 200],
    // Iced Signature Latte (15): shot only; ice + milk from modifier groups
    [15,  1, 1],
    // Iced Matcha (16): matcha only; ice + plant milk from modifier groups
    [16,  9, 5],
    // Brown Sugar Iced (17): shot + brown sugar; ice + milk from modifier groups
    [17,  1, 1], [17, 12, 20],
    // (Food items 18-22 have no ingredient recipes — pre-made)
    // Strawberry Smoothie (23): 150ml puree + 50ml milk
    [23, 15, 150], [23, 2, 50],
    // Mango Smoothie (24): 150ml puree + 50ml milk
    [24, 16, 150], [24, 2, 50],
    // Fresh Orange Juice (25): 200g orange
    [25, 17, 200],
];

// =========================================================================
// Seeder class
// =========================================================================

export class CafeMenuSeeder {

    public static async seed(): Promise<void> {
        try {
            await CafeMenuSeeder._seedTypes();
            await CafeMenuSeeder._seedIngredients();
            await CafeMenuSeeder._seedMenus();
            await CafeMenuSeeder._seedModifiers();
            // PostgreSQL: rows inserted with explicit `id` in bulkCreate do not advance SERIAL;
            // without this, the next app INSERT reuses 1 and hits menus_pkey.
            await CafeMenuSeeder._syncPostgresIdSequences();
            await CafeMenuSeeder._seedInitialStock();
        } catch (err) {
            console.error('\x1b[31mError in CafeMenuSeeder:', err.message);
            throw err;
        }
    }

    // ── Menu types ────────────────────────────────────────────────────────
    private static async _seedTypes() {
        await MenuType.bulkCreate(TYPES);
        console.log('\x1b[32m✔  Menu types inserted (%d rows)', TYPES.length);
    }

    // ── Ingredients (before products: recipes reference ingredient ids) ────
    private static async _seedIngredients() {
        await MenuIngredient.bulkCreate(INGREDIENTS);
        console.log('\x1b[32m✔  Ingredients inserted (%d rows)', INGREDIENTS.length);
    }

    // ── Menus (recipes JSON on each row, built from RECIPES) ─────────────
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

    /** Sugar / ice / plant-milk groups; hot latte (3) + iced matcha (16) + brown-sugar (17) with full modifier demo. */
    private static async _seedModifiers() {
        await ModifierGroup.bulkCreate([
            { id: 1, name: 'Sugar level', code: 'sugar', sort_order: 0, is_active: true },
            { id: 2, name: 'Ice',         code: 'ice',  sort_order: 1, is_active: true },
            { id: 3, name: 'Milk',        code: 'milk', sort_order: 2, is_active: true },
        ] as any);
        await ModifierOption.bulkCreate([
            { id: 1, group_id: 1, label: '0%', code: 's0', price_delta: 0, sort_order: 0, is_active: true, is_default: true, ingredient_recipe: [] },
            { id: 2, group_id: 1, label: '30%', code: 's30', price_delta: 0, sort_order: 1, is_active: true, is_default: false, ingredient_recipe: [{ ingredient_id: 4, quantity: 5 }] },
            { id: 3, group_id: 1, label: '50%', code: 's50', price_delta: 0, sort_order: 2, is_active: true, is_default: false, ingredient_recipe: [{ ingredient_id: 4, quantity: 10 }] },
            { id: 4, group_id: 1, label: '70%', code: 's70', price_delta: 0, sort_order: 3, is_active: true, is_default: false, ingredient_recipe: [{ ingredient_id: 4, quantity: 15 }] },
            { id: 5, group_id: 1, label: '100%', code: 's100', price_delta: 0, sort_order: 4, is_active: true, is_default: false, ingredient_recipe: [{ ingredient_id: 4, quantity: 20 }] },
            { id: 6, group_id: 2, label: 'No ice', code: 'i0', price_delta: 0, sort_order: 0, is_active: true, is_default: false, ingredient_recipe: [] },
            { id: 7, group_id: 2, label: 'Less ice', code: 'i_less', price_delta: 0, sort_order: 1, is_active: true, is_default: false, ingredient_recipe: [{ ingredient_id: 5, quantity: 80 }] },
            { id: 8, group_id: 2, label: 'Regular', code: 'i_reg', price_delta: 0, sort_order: 2, is_active: true, is_default: true, ingredient_recipe: [{ ingredient_id: 5, quantity: 150 }] },
            { id: 9, group_id: 2, label: 'Extra ice', code: 'i_x', price_delta: 0, sort_order: 3, is_active: true, is_default: false, ingredient_recipe: [{ ingredient_id: 5, quantity: 200 }] },
            { id: 10, group_id: 3, label: 'Fresh dairy', code: 'm_cow', price_delta: 0, sort_order: 0, is_active: true, is_default: true, ingredient_recipe: [{ ingredient_id: 2, quantity: 180 }] },
            { id: 11, group_id: 3, label: 'Oat', code: 'm_oat', price_delta: 2000, sort_order: 1, is_active: true, is_default: false, ingredient_recipe: [{ ingredient_id: 3, quantity: 180 }] },
            { id: 12, group_id: 3, label: 'Almond', code: 'm_alm', price_delta: 2000, sort_order: 2, is_active: true, is_default: false, ingredient_recipe: [{ ingredient_id: 2, quantity: 180 }] },
            { id: 13, group_id: 3, label: 'Soy', code: 'm_soy', price_delta: 1500, sort_order: 3, is_active: true, is_default: false, ingredient_recipe: [{ ingredient_id: 2, quantity: 180 }] },
        ] as any);
        await MenuModifierGroup.bulkCreate([
            { menu_id: 3, modifier_group_id: 1, sort_order: 0, is_required: true },
            { menu_id: 3, modifier_group_id: 3, sort_order: 1, is_required: false },
            { menu_id: 15, modifier_group_id: 1, sort_order: 0, is_required: true },
            { menu_id: 15, modifier_group_id: 2, sort_order: 1, is_required: true },
            { menu_id: 15, modifier_group_id: 3, sort_order: 2, is_required: false },
            { menu_id: 16, modifier_group_id: 1, sort_order: 0, is_required: true },
            { menu_id: 16, modifier_group_id: 2, sort_order: 1, is_required: true },
            { menu_id: 16, modifier_group_id: 3, sort_order: 2, is_required: false },
            { menu_id: 17, modifier_group_id: 1, sort_order: 0, is_required: true },
            { menu_id: 17, modifier_group_id: 2, sort_order: 1, is_required: true },
            { menu_id: 17, modifier_group_id: 3, sort_order: 2, is_required: false },
        ] as any);
        console.log('\x1b[32m✔  Modifier groups, options, and menu links inserted');
    }

    /** Advance SERIAL/identity so it is past MAX(id) after bulk rows with fixed ids. */
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

    // ── Initial stock IN movement for each ingredient ─────────────────────────
    private static async _seedInitialStock() {
        const rows = INGREDIENTS.map(ing => ({
            ingredient_id: ing.id,
            type         : StockMovementType.IN,
            quantity     : ing.quantity,
            note         : 'Initial opening stock',
            created_by   : 1, // admin
            created_at   : daysAgo(90),
        }));
        await IngredientStockMovement.bulkCreate(rows);
        console.log('\x1b[32m✔  Initial stock movements inserted (%d rows)', rows.length);
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function daysAgo(n: number, hourOffset = 0): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(hourOffset, 0, 0, 0);
    return d;
}
