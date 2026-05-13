import Menu from '@app/models/menu/menu.model';
import MenuType from '@app/models/menu/menu-type.model';

export class MenuSeeder {
    public static async seed() {
        try {
            await MenuSeeder.seedMenuTypes();
            await MenuSeeder.seedMenus();
        } catch (error) {
            console.error('\x1b[31m\nError seeding menus:', error);
        }
    }

    private static async seedMenuTypes() {
        try {
            await MenuType.bulkCreate(menuSeederData.types);
            console.log('\x1b[32mMenu types inserted successfully.');
        } catch (error) {
            console.error('Error seeding menu types:', error);
            throw error;
        }
    }

    private static async seedMenus() {
        try {
            const rows = menuSeederData.menus.map((m) => ({
                ...m,
                discount: m.discount ?? 0,
                recipes: m.recipes ?? [],
            }));
            await Menu.bulkCreate(rows as any);
            console.log('\x1b[32mMenus inserted successfully.');
        } catch (error) {
            console.error('Error seeding menus:', error);
            throw error;
        }
    }
}

const menuSeederData = {
    types: [
        { name: 'Hot Beverages',   image: 'static/pos/products/menu/hot_americano.png' },
        { name: 'Chill Beverages', image: 'static/pos/products/menu/ice_americano.png' },
        { name: 'Frappe',          image: 'static/pos/products/menu/cafe_frappe.png' },
        { name: 'Soda',            image: 'static/pos/products/menu/strawberry_soda.png' },
    ],
    menus: [
        {
            code: 'C54-H01',
            type_id: 1,
            name: 'Single Espresso',
            unit_price: 6000,
            image: 'static/pos/products/menu/single_expresso.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'C54-H02',
            type_id: 1,
            name: 'Double Espresso',
            unit_price: 9000,
            image: 'static/pos/products/menu/single_expresso.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'C54-H03',
            type_id: 1,
            name: 'Hot Americano',
            unit_price: 10000,
            image: 'static/pos/products/menu/hot_americano.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'C54-H04',
            type_id: 1,
            name: 'Hot Cafe Latte',
            unit_price: 14000,
            image: 'static/pos/products/menu/hot_cafe_latte.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'C54-H05',
            type_id: 1,
            name: 'Hot Cappuccino',
            unit_price: 14000,
            image: 'static/pos/products/menu/hot_cappuccino.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'C54-H06',
            type_id: 1,
            name: 'Hot Matcha Latte',
            unit_price: 15000,
            image: 'static/pos/products/menu/hot_matcha_latte.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'C54-C01',
            type_id: 2,
            name: 'Iced Americano',
            unit_price: 11000,
            image: 'static/pos/products/menu/ice_americano.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'C54-C02',
            type_id: 2,
            name: 'Iced Latte',
            unit_price: 15000,
            image: 'static/pos/products/menu/ice_latte.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'C54-C03',
            type_id: 2,
            name: 'Iced Cappuccino',
            unit_price: 15000,
            image: 'static/pos/products/menu/ice_cappuccino.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'C54-C04',
            type_id: 2,
            name: 'Iced Chocolate',
            unit_price: 15000,
            image: 'static/pos/products/menu/ice_chocolate.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'C54-C05',
            type_id: 2,
            name: 'Iced Matcha Latte',
            unit_price: 16000,
            image: 'static/pos/products/menu/ice_matcha_latte.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'C54-F01',
            type_id: 3,
            name: 'Cafe Frappe',
            unit_price: 16000,
            image: 'static/pos/products/menu/cafe_frappe.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'C54-F02',
            type_id: 3,
            name: 'Chocolate Frappe',
            unit_price: 16000,
            image: 'static/pos/products/menu/chocolate_frappe.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'C54-F03',
            type_id: 3,
            name: 'Matcha Frappe',
            unit_price: 17000,
            image: 'static/pos/products/menu/matcha_frappe.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'C54-F04',
            type_id: 3,
            name: 'Strawberry Frappe',
            unit_price: 15000,
            image: 'static/pos/products/menu/strawberry_frappe.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'C54-F05',
            type_id: 3,
            name: 'Mango Frappe',
            unit_price: 15000,
            image: 'static/pos/products/menu/mango_frappe.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'C54-S01',
            type_id: 4,
            name: 'Strawberry Soda',
            unit_price: 12000,
            image: 'static/pos/products/menu/strawberry_soda.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'C54-S02',
            type_id: 4,
            name: 'Peach Soda',
            unit_price: 12000,
            image: 'static/pos/products/menu/peach_soda.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
    ],
};
