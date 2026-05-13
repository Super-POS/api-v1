import { Sequelize }            from 'sequelize-typescript';
import MenuIngredient         from '@app/models/menu/menu-ingredient.model';
import MenuSize               from '@app/models/menu/menu-size.model';
import IngredientStockMovement, { StockMovementType } from '@app/models/menu/stock_movement.model';
import Menu                   from '@app/models/menu/menu.model';
import MenuType                from '@app/models/menu/menu-type.model';
import ModifierGroup          from '@app/models/menu/modifier-group.model';
import ModifierOption         from '@app/models/menu/modifier-option.model';
import MenuModifierGroup      from '@app/models/menu/menu-modifier-group.model';

// =========================================================================
// CLUB 54 — Coffee catalogue with S/M/L size support.
// Espresso: 1 shot = 30 ml, 2 shots = 60 ml.
// Flavored syrup: 10 ml per pump (M = 2 pumps, L = 3 pumps).
// Ice "1 cup" ≈ 150 g for stock deduction.
// =========================================================================

const TYPES = [
    { id: 1, name: 'CLUB 54 — Hot Beverages',    image: 'static/pos/products/type/coffee.jpg' },
    { id: 2, name: 'CLUB 54 — Chill Beverages',  image: 'static/pos/products/type/cold-brew.jpg' },
    { id: 3, name: 'CLUB 54 — Frappe',            image: 'static/pos/products/type/smoothie.jpg' },
    { id: 4, name: 'CLUB 54 — Soda',              image: 'static/pos/products/smoothie/strawberry.jpg' },
];

// Single-price items (no sizes): espresso shots served as fixed volume.
// Sized items (has_sizes = true): unit_price and recipes are null / [] on the menu row
//   — actual price + recipe live in menu_sizes.
const MENUS = [
    // ── Hot — no sizes (fixed serving) ───────────────────────────────────
    { id:  1, code: 'C54-H01', type_id: 1, name: 'Single Espresso',    has_sizes: false, unit_price:  6000, discount: 0, image: 'static/pos/products/coffee/espresso.jpg',  creator_id: 1 },
    { id:  2, code: 'C54-H02', type_id: 1, name: 'Double Espresso',    has_sizes: false, unit_price:  9000, discount: 0, image: 'static/pos/products/coffee/espresso.jpg',  creator_id: 1 },
    // ── Hot — S / M / L ───────────────────────────────────────────────────
    { id:  3, code: 'C54-H03', type_id: 1, name: 'Hot Americano',      has_sizes: true,  unit_price: null,  discount: 0, image: 'static/pos/products/coffee/americano.jpg',  creator_id: 1 },
    { id:  4, code: 'C54-H04', type_id: 1, name: 'Hot Café Latte',     has_sizes: true,  unit_price: null,  discount: 0, image: 'static/pos/products/coffee/latte.jpg',       creator_id: 1 },
    { id:  5, code: 'C54-H05', type_id: 1, name: 'Hot Cappuccino',     has_sizes: true,  unit_price: null,  discount: 0, image: 'static/pos/products/coffee/cappuccino.jpg',  creator_id: 1 },
    { id:  6, code: 'C54-H06', type_id: 1, name: 'Hot Matcha Latte',   has_sizes: true,  unit_price: null,  discount: 0, image: 'static/pos/products/tea/matcha-latte.jpg',   creator_id: 1 },
    // ── Iced — S / M / L ─────────────────────────────────────────────────
    { id:  7, code: 'C54-C01', type_id: 2, name: 'Iced Americano',     has_sizes: true,  unit_price: null,  discount: 0, image: 'static/pos/products/cold/iced-americano.jpg', creator_id: 1 },
    { id:  8, code: 'C54-C02', type_id: 2, name: 'Iced Latte',         has_sizes: true,  unit_price: null,  discount: 0, image: 'static/pos/products/cold/iced-latte.jpg',      creator_id: 1 },
    { id:  9, code: 'C54-C03', type_id: 2, name: 'Iced Cappuccino',    has_sizes: true,  unit_price: null,  discount: 0, image: 'static/pos/products/coffee/cappuccino.jpg',    creator_id: 1 },
    { id: 10, code: 'C54-C04', type_id: 2, name: 'Iced Chocolate',     has_sizes: true,  unit_price: null,  discount: 0, image: 'static/pos/products/coffee/mocha.jpg',          creator_id: 1 },
    { id: 11, code: 'C54-C05', type_id: 2, name: 'Iced Matcha Latte',  has_sizes: true,  unit_price: null,  discount: 0, image: 'static/pos/products/cold/iced-matcha.jpg',     creator_id: 1 },
    // ── Frappe — S / M / L ───────────────────────────────────────────────
    { id: 12, code: 'C54-F01', type_id: 3, name: 'Café Frappe',        has_sizes: true,  unit_price: null,  discount: 0, image: 'static/pos/products/cold/iced-latte.jpg',      creator_id: 1 },
    { id: 13, code: 'C54-F02', type_id: 3, name: 'Chocolate Frappe',   has_sizes: true,  unit_price: null,  discount: 0, image: 'static/pos/products/coffee/mocha.jpg',          creator_id: 1 },
    { id: 14, code: 'C54-F03', type_id: 3, name: 'Matcha Frappe',      has_sizes: true,  unit_price: null,  discount: 0, image: 'static/pos/products/cold/iced-matcha.jpg',     creator_id: 1 },
    { id: 15, code: 'C54-F04', type_id: 3, name: 'Strawberry Frappe',  has_sizes: true,  unit_price: null,  discount: 0, image: 'static/pos/products/smoothie/strawberry.jpg',  creator_id: 1 },
    { id: 16, code: 'C54-F05', type_id: 3, name: 'Mango Frappe',       has_sizes: true,  unit_price: null,  discount: 0, image: 'static/pos/products/smoothie/mango.jpg',        creator_id: 1 },
    // ── Soda — S / M / L ─────────────────────────────────────────────────
    { id: 17, code: 'C54-S01', type_id: 4, name: 'Strawberry Soda',    has_sizes: true,  unit_price: null,  discount: 0, image: 'static/pos/products/smoothie/strawberry.jpg',  creator_id: 1 },
    { id: 18, code: 'C54-S02', type_id: 4, name: 'Peach Soda',         has_sizes: true,  unit_price: null,  discount: 0, image: 'static/pos/products/smoothie/orange-juice.jpg', creator_id: 1 },
];

// Fixed-price recipes (menu_id has has_sizes = false)
// [menu_id, ingredient_id, quantity_per_serving]
const SINGLE_RECIPES: [number, number, number][] = [
    [1, 1, 1],          // Single Espresso: 1 shot
    [2, 1, 2],          // Double Espresso: 2 shots
];

type SizeRecipe = { ingredient_id: number; quantity: number };
type SizeEntry  = { menu_id: number; size: 'S' | 'M' | 'L'; price: number; recipes: SizeRecipe[] };

// Each sized menu has one entry per size it offers.
// Prices in KHR. S = 8 oz, M = 12 oz, L = 16 oz.
const MENU_SIZES: SizeEntry[] = [
    // ── Hot Americano (id 3) ──────────────────────────────────────────────
    { menu_id: 3,  size: 'S', price:  8000, recipes: [{ ingredient_id: 1, quantity: 1 }, { ingredient_id: 3, quantity: 240 }, { ingredient_id: 6, quantity: 1 }] },
    { menu_id: 3,  size: 'M', price: 10000, recipes: [{ ingredient_id: 1, quantity: 1 }, { ingredient_id: 3, quantity: 290 }, { ingredient_id: 6, quantity: 1 }] },
    { menu_id: 3,  size: 'L', price: 12000, recipes: [{ ingredient_id: 1, quantity: 2 }, { ingredient_id: 3, quantity: 320 }, { ingredient_id: 6, quantity: 1 }] },
    // ── Hot Café Latte (id 4) ─────────────────────────────────────────────
    { menu_id: 4,  size: 'S', price: 12000, recipes: [{ ingredient_id: 1, quantity: 1 }, { ingredient_id: 2, quantity: 220 }, { ingredient_id: 6, quantity: 1 }] },
    { menu_id: 4,  size: 'M', price: 14000, recipes: [{ ingredient_id: 1, quantity: 1 }, { ingredient_id: 2, quantity: 280 }, { ingredient_id: 6, quantity: 1 }] },
    { menu_id: 4,  size: 'L', price: 16000, recipes: [{ ingredient_id: 1, quantity: 2 }, { ingredient_id: 2, quantity: 320 }, { ingredient_id: 6, quantity: 1 }] },
    // ── Hot Cappuccino (id 5) ─────────────────────────────────────────────
    { menu_id: 5,  size: 'S', price: 12000, recipes: [{ ingredient_id: 1, quantity: 1 }, { ingredient_id: 2, quantity: 220 }, { ingredient_id: 7, quantity: 2 }, { ingredient_id: 6, quantity: 1 }] },
    { menu_id: 5,  size: 'M', price: 14000, recipes: [{ ingredient_id: 1, quantity: 1 }, { ingredient_id: 2, quantity: 280 }, { ingredient_id: 7, quantity: 3 }, { ingredient_id: 6, quantity: 1 }] },
    { menu_id: 5,  size: 'L', price: 16000, recipes: [{ ingredient_id: 1, quantity: 2 }, { ingredient_id: 2, quantity: 320 }, { ingredient_id: 7, quantity: 3 }, { ingredient_id: 6, quantity: 1 }] },
    // ── Hot Matcha Latte (id 6) ───────────────────────────────────────────
    { menu_id: 6,  size: 'S', price: 13000, recipes: [{ ingredient_id: 8, quantity: 3 }, { ingredient_id: 3, quantity: 60 }, { ingredient_id: 2, quantity: 220 }, { ingredient_id: 6, quantity: 1 }] },
    { menu_id: 6,  size: 'M', price: 15000, recipes: [{ ingredient_id: 8, quantity: 4 }, { ingredient_id: 3, quantity: 60 }, { ingredient_id: 2, quantity: 280 }, { ingredient_id: 6, quantity: 1 }] },
    { menu_id: 6,  size: 'L', price: 17000, recipes: [{ ingredient_id: 8, quantity: 6 }, { ingredient_id: 3, quantity: 60 }, { ingredient_id: 2, quantity: 320 }, { ingredient_id: 6, quantity: 1 }] },
    // ── Iced Americano (id 7) ─────────────────────────────────────────────
    { menu_id: 7,  size: 'S', price:  9000, recipes: [{ ingredient_id: 1, quantity: 1 }, { ingredient_id: 20, quantity:  80 }, { ingredient_id: 5, quantity: 150 }] },
    { menu_id: 7,  size: 'M', price: 11000, recipes: [{ ingredient_id: 1, quantity: 2 }, { ingredient_id: 20, quantity: 100 }, { ingredient_id: 5, quantity: 150 }] },
    { menu_id: 7,  size: 'L', price: 13000, recipes: [{ ingredient_id: 1, quantity: 3 }, { ingredient_id: 20, quantity: 150 }, { ingredient_id: 5, quantity: 150 }] },
    // ── Iced Latte (id 8) ─────────────────────────────────────────────────
    { menu_id: 8,  size: 'S', price: 13000, recipes: [{ ingredient_id: 1, quantity: 1 }, { ingredient_id: 2, quantity:  80 }, { ingredient_id: 5, quantity: 150 }] },
    { menu_id: 8,  size: 'M', price: 15000, recipes: [{ ingredient_id: 1, quantity: 2 }, { ingredient_id: 2, quantity: 100 }, { ingredient_id: 5, quantity: 150 }] },
    { menu_id: 8,  size: 'L', price: 17000, recipes: [{ ingredient_id: 1, quantity: 3 }, { ingredient_id: 2, quantity: 140 }, { ingredient_id: 5, quantity: 150 }] },
    // ── Iced Cappuccino (id 9) ────────────────────────────────────────────
    { menu_id: 9,  size: 'S', price: 13000, recipes: [{ ingredient_id: 1, quantity: 1 }, { ingredient_id: 2, quantity:  80 }, { ingredient_id: 7, quantity: 2 }, { ingredient_id: 5, quantity: 150 }] },
    { menu_id: 9,  size: 'M', price: 15000, recipes: [{ ingredient_id: 1, quantity: 2 }, { ingredient_id: 2, quantity: 100 }, { ingredient_id: 7, quantity: 3 }, { ingredient_id: 5, quantity: 150 }] },
    { menu_id: 9,  size: 'L', price: 17000, recipes: [{ ingredient_id: 1, quantity: 3 }, { ingredient_id: 2, quantity: 140 }, { ingredient_id: 7, quantity: 5 }, { ingredient_id: 5, quantity: 150 }] },
    // ── Iced Chocolate (id 10) ────────────────────────────────────────────
    { menu_id: 10, size: 'S', price: 13000, recipes: [{ ingredient_id: 9, quantity: 25 }, { ingredient_id: 2, quantity: 100 }, { ingredient_id: 5, quantity: 150 }] },
    { menu_id: 10, size: 'M', price: 15000, recipes: [{ ingredient_id: 9, quantity: 30 }, { ingredient_id: 2, quantity: 130 }, { ingredient_id: 5, quantity: 150 }] },
    { menu_id: 10, size: 'L', price: 17000, recipes: [{ ingredient_id: 9, quantity: 45 }, { ingredient_id: 2, quantity: 150 }, { ingredient_id: 5, quantity: 150 }] },
    // ── Iced Matcha Latte (id 11) ─────────────────────────────────────────
    { menu_id: 11, size: 'S', price: 14000, recipes: [{ ingredient_id: 8, quantity: 3 }, { ingredient_id: 2, quantity:  90 }, { ingredient_id: 5, quantity: 150 }] },
    { menu_id: 11, size: 'M', price: 16000, recipes: [{ ingredient_id: 8, quantity: 4 }, { ingredient_id: 2, quantity: 120 }, { ingredient_id: 5, quantity: 150 }] },
    { menu_id: 11, size: 'L', price: 18000, recipes: [{ ingredient_id: 8, quantity: 6 }, { ingredient_id: 2, quantity: 150 }, { ingredient_id: 5, quantity: 150 }] },
    // ── Café Frappe (id 12) ───────────────────────────────────────────────
    { menu_id: 12, size: 'S', price: 14000, recipes: [{ ingredient_id: 1, quantity: 1 }, { ingredient_id: 2, quantity:  80 }, { ingredient_id: 10, quantity: 4 }, { ingredient_id: 7, quantity: 2 }, { ingredient_id: 5, quantity: 150 }] },
    { menu_id: 12, size: 'M', price: 16000, recipes: [{ ingredient_id: 1, quantity: 2 }, { ingredient_id: 2, quantity: 100 }, { ingredient_id: 10, quantity: 5 }, { ingredient_id: 7, quantity: 3 }, { ingredient_id: 5, quantity: 150 }] },
    { menu_id: 12, size: 'L', price: 18000, recipes: [{ ingredient_id: 1, quantity: 3 }, { ingredient_id: 2, quantity: 120 }, { ingredient_id: 10, quantity: 5 }, { ingredient_id: 7, quantity: 3 }, { ingredient_id: 5, quantity: 150 }] },
    // ── Chocolate Frappe (id 13) ──────────────────────────────────────────
    { menu_id: 13, size: 'S', price: 14000, recipes: [{ ingredient_id: 9, quantity: 25 }, { ingredient_id: 2, quantity:  80 }, { ingredient_id: 10, quantity: 4 }, { ingredient_id: 7, quantity: 2 }, { ingredient_id: 5, quantity: 150 }] },
    { menu_id: 13, size: 'M', price: 16000, recipes: [{ ingredient_id: 9, quantity: 30 }, { ingredient_id: 2, quantity: 100 }, { ingredient_id: 10, quantity: 5 }, { ingredient_id: 7, quantity: 3 }, { ingredient_id: 5, quantity: 150 }] },
    { menu_id: 13, size: 'L', price: 18000, recipes: [{ ingredient_id: 9, quantity: 45 }, { ingredient_id: 2, quantity: 120 }, { ingredient_id: 10, quantity: 5 }, { ingredient_id: 7, quantity: 3 }, { ingredient_id: 5, quantity: 150 }] },
    // ── Matcha Frappe (id 14) ─────────────────────────────────────────────
    { menu_id: 14, size: 'S', price: 15000, recipes: [{ ingredient_id: 8, quantity: 4 }, { ingredient_id: 11, quantity: 4 }, { ingredient_id: 2, quantity:  80 }, { ingredient_id: 5, quantity: 150 }] },
    { menu_id: 14, size: 'M', price: 17000, recipes: [{ ingredient_id: 8, quantity: 6 }, { ingredient_id: 11, quantity: 5 }, { ingredient_id: 2, quantity: 100 }, { ingredient_id: 5, quantity: 150 }] },
    { menu_id: 14, size: 'L', price: 19000, recipes: [{ ingredient_id: 8, quantity: 8 }, { ingredient_id: 11, quantity: 5 }, { ingredient_id: 2, quantity: 120 }, { ingredient_id: 5, quantity: 150 }] },
    // ── Strawberry Frappe (id 15) ─────────────────────────────────────────
    { menu_id: 15, size: 'S', price: 13000, recipes: [{ ingredient_id: 12, quantity: 15 }, { ingredient_id: 20, quantity:  60 }, { ingredient_id: 13, quantity:  8 }, { ingredient_id: 14, quantity:  8 }, { ingredient_id: 5, quantity: 150 }] },
    { menu_id: 15, size: 'M', price: 15000, recipes: [{ ingredient_id: 12, quantity: 20 }, { ingredient_id: 20, quantity:  80 }, { ingredient_id: 13, quantity: 10 }, { ingredient_id: 14, quantity: 10 }, { ingredient_id: 5, quantity: 150 }] },
    { menu_id: 15, size: 'L', price: 17000, recipes: [{ ingredient_id: 12, quantity: 30 }, { ingredient_id: 20, quantity: 100 }, { ingredient_id: 13, quantity: 10 }, { ingredient_id: 14, quantity: 10 }, { ingredient_id: 5, quantity: 150 }] },
    // ── Mango Frappe (id 16) ──────────────────────────────────────────────
    { menu_id: 16, size: 'S', price: 13000, recipes: [{ ingredient_id: 15, quantity: 15 }, { ingredient_id: 20, quantity:  60 }, { ingredient_id: 13, quantity:  8 }, { ingredient_id: 14, quantity:  8 }, { ingredient_id: 5, quantity: 150 }] },
    { menu_id: 16, size: 'M', price: 15000, recipes: [{ ingredient_id: 15, quantity: 20 }, { ingredient_id: 20, quantity:  80 }, { ingredient_id: 13, quantity: 10 }, { ingredient_id: 14, quantity: 10 }, { ingredient_id: 5, quantity: 150 }] },
    { menu_id: 16, size: 'L', price: 17000, recipes: [{ ingredient_id: 15, quantity: 30 }, { ingredient_id: 20, quantity: 100 }, { ingredient_id: 13, quantity: 10 }, { ingredient_id: 14, quantity: 10 }, { ingredient_id: 5, quantity: 150 }] },
    // ── Strawberry Soda (id 17) ───────────────────────────────────────────
    { menu_id: 17, size: 'S', price: 10000, recipes: [{ ingredient_id: 16, quantity: 15 }, { ingredient_id: 18, quantity:  90 }, { ingredient_id: 19, quantity: 5 }, { ingredient_id: 4, quantity:  8 }, { ingredient_id: 5, quantity: 150 }] },
    { menu_id: 17, size: 'M', price: 12000, recipes: [{ ingredient_id: 16, quantity: 20 }, { ingredient_id: 18, quantity: 120 }, { ingredient_id: 19, quantity: 5 }, { ingredient_id: 4, quantity: 10 }, { ingredient_id: 5, quantity: 150 }] },
    { menu_id: 17, size: 'L', price: 14000, recipes: [{ ingredient_id: 16, quantity: 30 }, { ingredient_id: 18, quantity: 150 }, { ingredient_id: 19, quantity: 5 }, { ingredient_id: 4, quantity: 10 }, { ingredient_id: 5, quantity: 150 }] },
    // ── Peach Soda (id 18) ────────────────────────────────────────────────
    { menu_id: 18, size: 'S', price: 10000, recipes: [{ ingredient_id: 17, quantity: 15 }, { ingredient_id: 18, quantity:  90 }, { ingredient_id: 14, quantity: 5 }, { ingredient_id: 4, quantity:  8 }, { ingredient_id: 5, quantity: 150 }] },
    { menu_id: 18, size: 'M', price: 12000, recipes: [{ ingredient_id: 17, quantity: 20 }, { ingredient_id: 18, quantity: 120 }, { ingredient_id: 14, quantity: 5 }, { ingredient_id: 4, quantity: 10 }, { ingredient_id: 5, quantity: 150 }] },
    { menu_id: 18, size: 'L', price: 14000, recipes: [{ ingredient_id: 17, quantity: 30 }, { ingredient_id: 18, quantity: 150 }, { ingredient_id: 14, quantity: 5 }, { ingredient_id: 4, quantity: 10 }, { ingredient_id: 5, quantity: 150 }] },
];

/**
 * unit_cost = cost per base unit (ml / g / pcs / shot).
 * IDs 1–5 align with modifier options (espresso / milk / sugar syrup / ice).
 */
const INGREDIENTS = [
    { id:  1, name: 'Espresso Shot',       unit: 'shot', quantity: 800,    unit_cost: 0.30   },
    { id:  2, name: 'Fresh Milk',          unit: 'ml',   quantity: 25000,  unit_cost: 0.005  },
    { id:  3, name: 'Hot Water',           unit: 'ml',   quantity: 50000,  unit_cost: 0.0001 },
    { id:  4, name: 'Sugar Syrup',         unit: 'ml',   quantity: 8000,   unit_cost: 0.002  },
    { id:  5, name: 'Ice',                 unit: 'g',    quantity: 60000,  unit_cost: 0.0005 },
    { id:  6, name: 'Sugar Packet',        unit: 'pcs',  quantity: 2000,   unit_cost: 0.03   },
    { id:  7, name: 'Chocolate Powder',    unit: 'g',    quantity: 3000,   unit_cost: 0.02   },
    { id:  8, name: 'Matcha Powder',       unit: 'g',    quantity: 1500,   unit_cost: 0.05   },
    { id:  9, name: 'Chocolate Sauce',     unit: 'g',    quantity: 5000,   unit_cost: 0.015  },
    { id: 10, name: 'Vanilla Powder',      unit: 'g',    quantity: 2000,   unit_cost: 0.04   },
    { id: 11, name: 'Frappe Powder',       unit: 'g',    quantity: 2000,   unit_cost: 0.035  },
    { id: 12, name: 'Strawberry Puree',    unit: 'g',    quantity: 4000,   unit_cost: 0.018  },
    { id: 13, name: 'Smoothie Powder',     unit: 'g',    quantity: 2000,   unit_cost: 0.025  },
    { id: 14, name: 'Lemonade Syrup',      unit: 'ml',   quantity: 3000,   unit_cost: 0.008  },
    { id: 15, name: 'Mango Puree',         unit: 'g',    quantity: 4000,   unit_cost: 0.015  },
    { id: 16, name: 'Strawberry Syrup',    unit: 'ml',   quantity: 4000,   unit_cost: 0.012  },
    { id: 17, name: 'Peach Syrup',         unit: 'ml',   quantity: 4000,   unit_cost: 0.012  },
    { id: 18, name: 'Soda Water',          unit: 'ml',   quantity: 30000,  unit_cost: 0.002  },
    { id: 19, name: 'Lime Juice',          unit: 'ml',   quantity: 2000,   unit_cost: 0.01   },
    { id: 20, name: 'Cool Water',          unit: 'ml',   quantity: 50000,  unit_cost: 0.0001 },
    { id: 21, name: 'Oat Milk',            unit: 'ml',   quantity: 10000,  unit_cost: 0.008  },
];

export class CafeMenuSeeder {

    public static async seed(): Promise<void> {
        try {
            await CafeMenuSeeder._seedTypes();
            await CafeMenuSeeder._seedIngredients();
            await CafeMenuSeeder._seedMenus();
            await CafeMenuSeeder._seedMenuSizes();
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
        // Build per-serving recipe map for single-price menus only
        const recipeByMenuId = new Map<number, { ingredient_id: number; quantity: number }[]>();
        for (const [menuId, ingredient_id, quantity] of SINGLE_RECIPES) {
            if (!recipeByMenuId.has(menuId)) recipeByMenuId.set(menuId, []);
            recipeByMenuId.get(menuId)!.push({ ingredient_id, quantity });
        }

        const rows = MENUS.map((m) => ({
            ...m,
            recipes: recipeByMenuId.get(m.id) ?? [],
        }));
        await Menu.bulkCreate(rows as any);
        console.log('\x1b[32m✔  Menus inserted (%d rows)', rows.length);
    }

    private static async _seedMenuSizes() {
        await MenuSize.bulkCreate(MENU_SIZES as any);
        console.log('\x1b[32m✔  Menu sizes inserted (%d rows)', MENU_SIZES.length);
    }

    /** Sugar / ice / milk modifiers on iced and frappe lines. */
    private static async _seedModifiers() {
        await ModifierGroup.bulkCreate([
            { id: 1, name: 'Sugar level', code: 'sugar', sort_order: 0, is_active: true },
            { id: 2, name: 'Ice',         code: 'ice',   sort_order: 1, is_active: true },
            { id: 3, name: 'Milk',        code: 'milk',  sort_order: 2, is_active: true },
        ] as any);
        await ModifierOption.bulkCreate([
            { id:  1, group_id: 1, label: '0%',       code: 's0',    price_delta:    0, is_active: true, is_default: true,  ingredient_recipe: [] },
            { id:  2, group_id: 1, label: '30%',      code: 's30',   price_delta:    0, is_active: true, is_default: false, ingredient_recipe: [{ ingredient_id: 4, quantity:  5 }] },
            { id:  3, group_id: 1, label: '50%',      code: 's50',   price_delta:    0, is_active: true, is_default: false, ingredient_recipe: [{ ingredient_id: 4, quantity: 10 }] },
            { id:  4, group_id: 1, label: '70%',      code: 's70',   price_delta:    0, is_active: true, is_default: false, ingredient_recipe: [{ ingredient_id: 4, quantity: 15 }] },
            { id:  5, group_id: 1, label: '100%',     code: 's100',  price_delta:    0, is_active: true, is_default: false, ingredient_recipe: [{ ingredient_id: 4, quantity: 20 }] },
            { id:  6, group_id: 2, label: 'No ice',   code: 'i0',    price_delta:    0, is_active: true, is_default: false, ingredient_recipe: [] },
            { id:  7, group_id: 2, label: 'Less ice', code: 'i_less',price_delta:    0, is_active: true, is_default: false, ingredient_recipe: [{ ingredient_id: 5, quantity:  80 }] },
            { id:  8, group_id: 2, label: 'Regular',  code: 'i_reg', price_delta:    0, is_active: true, is_default: true,  ingredient_recipe: [{ ingredient_id: 5, quantity: 150 }] },
            { id:  9, group_id: 2, label: 'Extra ice',code: 'i_x',   price_delta:    0, is_active: true, is_default: false, ingredient_recipe: [{ ingredient_id: 5, quantity: 200 }] },
            { id: 10, group_id: 3, label: 'Fresh dairy', code: 'm_cow', price_delta: 0, is_active: true, is_default: true,  ingredient_recipe: [{ ingredient_id:  2, quantity: 180 }] },
            { id: 11, group_id: 3, label: 'Oat',      code: 'm_oat', price_delta: 2000, is_active: true, is_default: false, ingredient_recipe: [{ ingredient_id: 21, quantity: 180 }] },
            { id: 12, group_id: 3, label: 'Almond',   code: 'm_alm', price_delta: 2000, is_active: true, is_default: false, ingredient_recipe: [{ ingredient_id:  2, quantity: 180 }] },
            { id: 13, group_id: 3, label: 'Soy',      code: 'm_soy', price_delta: 1500, is_active: true, is_default: false, ingredient_recipe: [{ ingredient_id:  2, quantity: 180 }] },
        ] as any);

        // One entry per (menu, group) pair — sized menus share a single row now
        await MenuModifierGroup.bulkCreate([
            // Iced Americano (7)
            { menu_id:  7, modifier_group_id: 1, sort_order: 0, is_required: true },
            { menu_id:  7, modifier_group_id: 2, sort_order: 1, is_required: true },
            // Iced Latte (8)
            { menu_id:  8, modifier_group_id: 1, sort_order: 0, is_required: true },
            { menu_id:  8, modifier_group_id: 2, sort_order: 1, is_required: true },
            { menu_id:  8, modifier_group_id: 3, sort_order: 2, is_required: false },
            // Iced Cappuccino (9)
            { menu_id:  9, modifier_group_id: 1, sort_order: 0, is_required: true },
            { menu_id:  9, modifier_group_id: 2, sort_order: 1, is_required: true },
            // Iced Chocolate (10)
            { menu_id: 10, modifier_group_id: 2, sort_order: 0, is_required: true },
            // Iced Matcha Latte (11)
            { menu_id: 11, modifier_group_id: 1, sort_order: 0, is_required: true },
            { menu_id: 11, modifier_group_id: 2, sort_order: 1, is_required: true },
        ] as any);
        console.log('\x1b[32m✔  Modifier groups, options, and menu links inserted');
    }

    private static async _syncPostgresIdSequences(): Promise<void> {
        const seq = (Menu as unknown as { sequelize: Sequelize | undefined }).sequelize;
        if (!seq || seq.getDialect() !== 'postgres') return;
        for (const table of ['menu_types', 'menu_ingredients', 'menus', 'menu_sizes', 'modifier_groups', 'modifier_options'] as const) {
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
        const rows = INGREDIENTS.map((ing) => ({
            ingredient_id: ing.id,
            type:          StockMovementType.IN,
            quantity:      ing.quantity,
            note:          'Initial opening stock',
            created_by:    1,
            created_at:    daysAgo(90),
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
