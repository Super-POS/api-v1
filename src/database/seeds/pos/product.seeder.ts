import Product from "@app/models/product/product.model";
import Ingredient from "@app/models/product/ingredient.model";
import RecipeItem from "@app/models/product/recipe_item.model";
import ProductType from "@app/models/product/type.model";

export class ProductSeeder {
    public static async seed() {
        try {
            await ProductSeeder.seedProductTypes();
            await ProductSeeder.seedIngredients();
            await ProductSeeder.seedProducts();
            await ProductSeeder.seedRecipes();
        } catch (error) {
            console.error('\x1b[31m\nError seeding products:', error);
        }
    }

    private static async seedProductTypes() {
        try {
            await ProductType.bulkCreate(productSeederData.types);
            console.log('\x1b[32mProduct types inserted successfully.');
        } catch (error) {
            console.error('Error seeding product types:', error);
            throw error;
        }
    }

    private static async seedProducts() {
        try {
            await Product.bulkCreate(productSeederData.products);
            console.log('\x1b[32mProducts inserted successfully.');
        } catch (error) {
            console.error('Error seeding products:', error);
            throw error;
        }
    }

    private static async seedIngredients() {
        try {
            await Ingredient.bulkCreate(productSeederData.ingredients);
            console.log('\x1b[32mIngredients inserted successfully.');
        } catch (error) {
            console.error('Error seeding ingredients:', error);
            throw error;
        }
    }

    private static async seedRecipes() {
        try {
            await RecipeItem.bulkCreate(productSeederData.recipe_items);
            console.log('\x1b[32mRecipe items inserted successfully.');
        } catch (error) {
            console.error('Error seeding recipe items:', error);
            throw error;
        }
    }
}

// Mock data for products and product types
const productSeederData = {
    types: [
        { name: 'Coffee', image: 'static/pos/products/type/glass-tulip.png' },
        { name: 'Non-Coffee', image: 'static/pos/products/type/liquor.png' },
        { name: 'Bakery', image: 'static/pos/products/type/food.png' },
    ],
    ingredients: [
        { name: 'Coffee Beans', unit: 'g', stock: 25000, low_stock_threshold: 3000 },
        { name: 'Milk', unit: 'ml', stock: 50000, low_stock_threshold: 6000 },
        { name: 'Water', unit: 'ml', stock: 120000, low_stock_threshold: 15000 },
        { name: 'Chocolate Syrup', unit: 'ml', stock: 8000, low_stock_threshold: 1200 },
        { name: 'Caramel Syrup', unit: 'ml', stock: 7000, low_stock_threshold: 1000 },
        { name: 'Vanilla Syrup', unit: 'ml', stock: 7000, low_stock_threshold: 1000 },
        { name: 'Hazelnut Syrup', unit: 'ml', stock: 5000, low_stock_threshold: 800 },
        { name: 'Coconut Syrup', unit: 'ml', stock: 5000, low_stock_threshold: 800 },
        { name: 'Matcha Powder', unit: 'g', stock: 5000, low_stock_threshold: 700 },
        { name: 'Lemon Syrup', unit: 'ml', stock: 6000, low_stock_threshold: 900 },
        { name: 'Tea Base', unit: 'ml', stock: 12000, low_stock_threshold: 1500 },
        { name: 'Ice', unit: 'g', stock: 60000, low_stock_threshold: 8000 },
        { name: 'Croissant Piece', unit: 'piece', stock: 80, low_stock_threshold: 15 },
        { name: 'Muffin Piece', unit: 'piece', stock: 60, low_stock_threshold: 10 },
        { name: 'Sandwich Piece', unit: 'piece', stock: 50, low_stock_threshold: 8 },
        { name: 'Sugar', unit: 'g', stock: 20000, low_stock_threshold: 2500 },
        { name: 'Plastic Cup', unit: 'piece', stock: 2000, low_stock_threshold: 200 },
        { name: 'Paper Bag', unit: 'piece', stock: 500, low_stock_threshold: 60 },
        { name: 'Straw', unit: 'piece', stock: 3000, low_stock_threshold: 300 },
    ],
    products: [
        {
            code: 'C001',
            type_id: 1,
            name: 'Espresso',
            unit_price: 8000,
            image: 'uploads/menu/espresso.jpg',
            stock: 999,
            creator_id: 1,
        },
        {
            code: 'C002',
            type_id: 1,
            name: 'Americano',
            unit_price: 9000,
            image: 'uploads/menu/americano.jpg',
            stock: 999,
            creator_id: 1,
        },
        {
            code: 'C003',
            type_id: 1,
            name: 'Cappuccino',
            unit_price: 11000,
            image: 'uploads/menu/cappuccino.jpg',
            stock: 999,
            creator_id: 1,
        },
        {
            code: 'C004',
            type_id: 1,
            name: 'Cafe Latte',
            unit_price: 12000,
            image: 'uploads/menu/cafe-latte.jpg',
            stock: 999,
            creator_id: 1,
        },
        {
            code: 'C005',
            type_id: 1,
            name: 'Mocha',
            unit_price: 13000,
            image: 'uploads/menu/mocha.jpg',
            stock: 999,
            creator_id: 1,
        },
        {
            code: 'C006',
            type_id: 1,
            name: 'Caramel Macchiato',
            unit_price: 14000,
            image: 'uploads/menu/caramel-macchiato.jpg',
            stock: 999,
            creator_id: 1,
        },
        {
            code: 'C007',
            type_id: 1,
            name: 'Vanilla Latte',
            unit_price: 12000,
            image: 'uploads/menu/vanilla-latte.jpg',
            stock: 999,
            creator_id: 1,
        },
        {
            code: 'C008',
            type_id: 1,
            name: 'Flat White',
            unit_price: 11000,
            image: 'uploads/menu/flat-white.jpg',
            stock: 999,
            creator_id: 1,
        },
        {
            code: 'C009',
            type_id: 1,
            name: 'Iced Americano',
            unit_price: 9000,
            image: 'uploads/menu/iced-americano.jpg',
            stock: 999,
            creator_id: 1,
        },
        {
            code: 'C010',
            type_id: 1,
            name: 'Iced Latte',
            unit_price: 12000,
            image: 'uploads/menu/iced-latte.jpg',
            stock: 999,
            creator_id: 1,
        },
        {
            code: 'C011',
            type_id: 1,
            name: 'Hazelnut Latte',
            unit_price: 13000,
            image: 'uploads/menu/hazelnut-latte.jpg',
            stock: 999,
            creator_id: 1,
        },
        {
            code: 'C012',
            type_id: 1,
            name: 'Coconut Latte',
            unit_price: 13000,
            image: 'uploads/menu/coconut-latte.jpg',
            stock: 999,
            creator_id: 1,
        },
        {
            code: 'N001',
            type_id: 2,
            name: 'Iced Lemon Tea',
            unit_price: 7000,
            image: 'uploads/menu/iced-lemon-tea.jpg',
            stock: 999,
            creator_id: 1,
        },
        {
            code: 'N002',
            type_id: 2,
            name: 'Chocolate Milkshake',
            unit_price: 13000,
            image: 'uploads/menu/chocolate-milkshake.jpg',
            stock: 999,
            creator_id: 1,
        },
        {
            code: 'N003',
            type_id: 2,
            name: 'Matcha Latte',
            unit_price: 12000,
            image: 'uploads/menu/matcha-latte.jpg',
            stock: 999,
            creator_id: 1,
        },
        {
            code: 'B001',
            type_id: 3,
            name: 'Butter Croissant',
            unit_price: 7000,
            image: 'uploads/menu/butter-croissant.jpg',
            stock: 999,
            creator_id: 1,
        },
        {
            code: 'B002',
            type_id: 3,
            name: 'Blueberry Muffin',
            unit_price: 8500,
            image: 'uploads/menu/blueberry-muffin.jpg',
            stock: 999,
            creator_id: 1,
        },
        {
            code: 'B003',
            type_id: 3,
            name: 'Ham & Cheese Sandwich',
            unit_price: 10000,
            image: 'uploads/menu/ham-cheese-sandwich.jpg',
            stock: 999,
            creator_id: 1,
        },
    ],
    recipe_items: [
        { product_id: 1, ingredient_id: 1, qty_required: 18 },
        { product_id: 1, ingredient_id: 3, qty_required: 30 },
        { product_id: 2, ingredient_id: 1, qty_required: 18 },
        { product_id: 2, ingredient_id: 3, qty_required: 150 },
        { product_id: 3, ingredient_id: 1, qty_required: 18 },
        { product_id: 3, ingredient_id: 2, qty_required: 120 },
        { product_id: 4, ingredient_id: 1, qty_required: 18 },
        { product_id: 4, ingredient_id: 2, qty_required: 160 },
        { product_id: 5, ingredient_id: 1, qty_required: 18 },
        { product_id: 5, ingredient_id: 2, qty_required: 140 },
        { product_id: 5, ingredient_id: 4, qty_required: 20 },
        { product_id: 6, ingredient_id: 1, qty_required: 18 },
        { product_id: 6, ingredient_id: 2, qty_required: 150 },
        { product_id: 6, ingredient_id: 5, qty_required: 20 },
        { product_id: 7, ingredient_id: 1, qty_required: 18 },
        { product_id: 7, ingredient_id: 2, qty_required: 150 },
        { product_id: 7, ingredient_id: 6, qty_required: 20 },
        { product_id: 8, ingredient_id: 1, qty_required: 18 },
        { product_id: 8, ingredient_id: 2, qty_required: 130 },
        { product_id: 9, ingredient_id: 1, qty_required: 18 },
        { product_id: 9, ingredient_id: 3, qty_required: 120 },
        { product_id: 9, ingredient_id: 12, qty_required: 120 },
        { product_id: 10, ingredient_id: 1, qty_required: 18 },
        { product_id: 10, ingredient_id: 2, qty_required: 160 },
        { product_id: 10, ingredient_id: 12, qty_required: 120 },
        { product_id: 11, ingredient_id: 1, qty_required: 18 },
        { product_id: 11, ingredient_id: 2, qty_required: 150 },
        { product_id: 11, ingredient_id: 7, qty_required: 20 },
        { product_id: 12, ingredient_id: 1, qty_required: 18 },
        { product_id: 12, ingredient_id: 2, qty_required: 150 },
        { product_id: 12, ingredient_id: 8, qty_required: 20 },
        { product_id: 13, ingredient_id: 11, qty_required: 120 },
        { product_id: 13, ingredient_id: 10, qty_required: 20 },
        { product_id: 13, ingredient_id: 12, qty_required: 100 },
        { product_id: 14, ingredient_id: 2, qty_required: 220 },
        { product_id: 14, ingredient_id: 4, qty_required: 35 },
        { product_id: 14, ingredient_id: 12, qty_required: 120 },
        { product_id: 15, ingredient_id: 9, qty_required: 10 },
        { product_id: 15, ingredient_id: 2, qty_required: 200 },
        { product_id: 16, ingredient_id: 13, qty_required: 1 },
        { product_id: 17, ingredient_id: 14, qty_required: 1 },
        { product_id: 18, ingredient_id: 15, qty_required: 1 },
        // Drinks (products 1–15): sugar, plastic cup, straw per drink (ingredient ids 16, 17, 19)
        ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].flatMap((pid) => [
            { product_id: pid, ingredient_id: 16, qty_required: 5 },
            { product_id: pid, ingredient_id: 17, qty_required: 1 },
            { product_id: pid, ingredient_id: 19, qty_required: 1 },
        ]),
        // Bakery takeaway: paper bag
        { product_id: 16, ingredient_id: 18, qty_required: 1 },
        { product_id: 17, ingredient_id: 18, qty_required: 1 },
        { product_id: 18, ingredient_id: 18, qty_required: 1 },
    ]
};
