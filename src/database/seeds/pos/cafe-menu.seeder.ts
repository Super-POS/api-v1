import { Sequelize }            from 'sequelize-typescript';
import MenuIngredient         from '@app/models/menu/menu-ingredient.model';
import IngredientStockMovement, { StockMovementType } from '@app/models/menu/stock_movement.model';
import Menu                   from '@app/models/menu/menu.model';
import MenuType                from '@app/models/menu/menu-type.model';

// =========================================================================
// Catalogue data
// =========================================================================

const TYPES = [
    { id: 1, name: 'Coffee',              image: 'static/pos/products/type/coffee.png'     },
    { id: 2, name: 'Non-Coffee & Tea',    image: 'static/pos/products/type/tea.png'         },
    { id: 3, name: 'Cold Brew & Iced',    image: 'static/pos/products/type/cold-brew.png'   },
    { id: 4, name: 'Food & Pastry',       image: 'static/pos/products/type/pastry.png'      },
    { id: 5, name: 'Smoothies & Juice',   image: 'static/pos/products/type/smoothie.png'    },
];

const MENUS = [
    // ── Coffee ─────────────────────────────────────────────────────────────
    { id:  1, code: 'CF-001', type_id: 1, name: 'Espresso',               unit_price: 1.50, discount: 0, image: 'static/pos/products/coffee/espresso.png',        creator_id: 1 },
    { id:  2, code: 'CF-002', type_id: 1, name: 'Americano',              unit_price: 2.00, discount: 0, image: 'static/pos/products/coffee/americano.png',       creator_id: 1 },
    { id:  3, code: 'CF-003', type_id: 1, name: 'Cafe Latte',             unit_price: 3.00, discount: 0, image: 'static/pos/products/coffee/latte.png',           creator_id: 1 },
    { id:  4, code: 'CF-004', type_id: 1, name: 'Cappuccino',             unit_price: 3.00, discount: 0, image: 'static/pos/products/coffee/cappuccino.png',      creator_id: 1 },
    { id:  5, code: 'CF-005', type_id: 1, name: 'Flat White',             unit_price: 3.50, discount: 0, image: 'static/pos/products/coffee/flatwhite.png',       creator_id: 1 },
    { id:  6, code: 'CF-006', type_id: 1, name: 'Caramel Macchiato',      unit_price: 4.00, discount: 0, image: 'static/pos/products/coffee/macchiato.png',       creator_id: 1 },
    { id:  7, code: 'CF-007', type_id: 1, name: 'Mocha',                  unit_price: 3.50, discount: 0, image: 'static/pos/products/coffee/mocha.png',           creator_id: 1 },
    { id:  8, code: 'CF-008', type_id: 1, name: 'Dirty Matcha',           unit_price: 4.50, discount: 0, image: 'static/pos/products/coffee/dirty-matcha.png',    creator_id: 1 },
    // ── Non-Coffee & Tea ───────────────────────────────────────────────────
    { id:  9, code: 'NC-001', type_id: 2, name: 'Matcha Latte',           unit_price: 3.50, discount: 0, image: 'static/pos/products/tea/matcha-latte.png',       creator_id: 1 },
    { id: 10, code: 'NC-002', type_id: 2, name: 'Thai Milk Tea',          unit_price: 3.00, discount: 0, image: 'static/pos/products/tea/thai-tea.png',           creator_id: 1 },
    { id: 11, code: 'NC-003', type_id: 2, name: 'Chamomile Tea',          unit_price: 2.50, discount: 0, image: 'static/pos/products/tea/chamomile.png',          creator_id: 1 },
    { id: 12, code: 'NC-004', type_id: 2, name: 'Taro Milk Tea',          unit_price: 3.50, discount: 0, image: 'static/pos/products/tea/taro.png',               creator_id: 1 },
    // ── Cold Brew & Iced ───────────────────────────────────────────────────
    { id: 13, code: 'CB-001', type_id: 3, name: 'Cold Brew Classic',      unit_price: 3.50, discount: 0, image: 'static/pos/products/cold/cold-brew.png',         creator_id: 1 },
    { id: 14, code: 'CB-002', type_id: 3, name: 'Iced Americano',         unit_price: 2.50, discount: 0, image: 'static/pos/products/cold/iced-americano.png',    creator_id: 1 },
    { id: 15, code: 'CB-003', type_id: 3, name: 'Iced Cafe Latte',        unit_price: 3.50, discount: 0, image: 'static/pos/products/cold/iced-latte.png',        creator_id: 1 },
    { id: 16, code: 'CB-004', type_id: 3, name: 'Iced Matcha Latte',      unit_price: 4.00, discount: 0, image: 'static/pos/products/cold/iced-matcha.png',       creator_id: 1 },
    { id: 17, code: 'CB-005', type_id: 3, name: 'Brown Sugar Iced Latte', unit_price: 4.50, discount: 0, image: 'static/pos/products/cold/brown-sugar-latte.png', creator_id: 1 },
    // ── Food & Pastry ──────────────────────────────────────────────────────
    { id: 18, code: 'FP-001', type_id: 4, name: 'Butter Croissant',       unit_price: 2.50, discount: 0, image: 'static/pos/products/food/croissant.png',         creator_id: 1 },
    { id: 19, code: 'FP-002', type_id: 4, name: 'Cheesecake Slice',       unit_price: 3.50, discount: 0, image: 'static/pos/products/food/cheesecake.png',        creator_id: 1 },
    { id: 20, code: 'FP-003', type_id: 4, name: 'Banana Bread',           unit_price: 2.00, discount: 0, image: 'static/pos/products/food/banana-bread.png',      creator_id: 1 },
    { id: 21, code: 'FP-004', type_id: 4, name: 'Chocolate Muffin',       unit_price: 2.50, discount: 0, image: 'static/pos/products/food/muffin.png',            creator_id: 1 },
    { id: 22, code: 'FP-005', type_id: 4, name: 'Avocado Toast',          unit_price: 5.00, discount: 0, image: 'static/pos/products/food/avocado-toast.png',     creator_id: 1 },
    // ── Smoothies & Juice ──────────────────────────────────────────────────
    { id: 23, code: 'SJ-001', type_id: 5, name: 'Strawberry Smoothie',    unit_price: 4.00, discount: 0, image: 'static/pos/products/smoothie/strawberry.png',    creator_id: 1 },
    { id: 24, code: 'SJ-002', type_id: 5, name: 'Mango Smoothie',         unit_price: 4.00, discount: 0, image: 'static/pos/products/smoothie/mango.png',         creator_id: 1 },
    { id: 25, code: 'SJ-003', type_id: 5, name: 'Fresh Orange Juice',     unit_price: 3.50, discount: 0, image: 'static/pos/products/smoothie/orange-juice.png',  creator_id: 1 },
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
    // Cafe Latte (3): 1 shot + 180ml milk
    [3,  1, 1], [3,  2, 180],
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
    // Iced Cafe Latte (15): 1 shot + 180ml milk + 150g ice
    [15,  1, 1], [15,  2, 180], [15,  5, 150],
    // Iced Matcha Latte (16): 5g matcha + 180ml oat milk + 150g ice
    [16,  9, 5], [16,  3, 180], [16,  5, 150],
    // Brown Sugar Iced Latte (17): 1 shot + 180ml milk + 20g brown sugar + 150g ice
    [17,  1, 1], [17,  2, 180], [17, 12, 20], [17,  5, 150],
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

    /** Advance SERIAL/identity so it is past MAX(id) after bulk rows with fixed ids. */
    private static async _syncPostgresIdSequences(): Promise<void> {
        const seq = (Menu as unknown as { sequelize: Sequelize | undefined }).sequelize;
        if (!seq || seq.getDialect() !== 'postgres') {
            return;
        }
        for (const table of ['menu_types', 'menu_ingredients', 'menus'] as const) {
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
