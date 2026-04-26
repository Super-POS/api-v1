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
        { name: 'Beverage', image: 'static/pos/products/type/glass-tulip.png' },
        { name: 'Alcohol', image: 'static/pos/products/type/liquor.png' },
        { name: 'Food-Meat', image: 'static/pos/products/type/food.png' },
    ],
    menus: [
        {
            code: 'B001',
            type_id: 1,
            name: 'Logan Paul',
            unit_price: 3000,
            image: 'static/pos/products/beverage/prime.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'B002',
            type_id: 1,
            name: 'Sting',
            unit_price: 5000,
            image: 'static/pos/products/beverage/sting.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'B003',
            type_id: 1,
            name: 'Black Energy',
            unit_price: 2000,
            image: 'static/pos/products/beverage/exspress.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'B004',
            type_id: 1,
            name: 'Ize',
            unit_price: 4000,
            image: 'static/pos/products/beverage/ize.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'B005',
            type_id: 1,
            name: 'IZE Cola',
            unit_price: 5000,
            image: 'static/pos/products/beverage/IzeCola.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'B006',
            type_id: 1,
            name: 'Red Bull',
            unit_price: 10000,
            image: 'static/pos/products/beverage/redbullb.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'B007',
            type_id: 1,
            name: 'Red Bull Blue',
            unit_price: 1500,
            image: 'static/pos/products/beverage/redbullblue.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'B008',
            type_id: 1,
            name: 'Red Bull',
            unit_price: 12000,
            image: 'static/pos/products/beverage/red.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'B009',
            type_id: 1,
            name: 'Fanta',
            unit_price: 2000,
            image: 'static/pos/products/beverage/Fanta-Orange-Soft-Drink.jpg',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'B0010',
            type_id: 1,
            name: 'Sprite',
            unit_price: 3000,
            image: 'static/pos/products/beverage/sprite.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'B0011',
            type_id: 1,
            name: 'PepSi',
            unit_price: 2500,
            image: 'static/pos/products/beverage/pesi.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'B0012',
            type_id: 1,
            name: 'CocaCola',
            unit_price: 2000,
            image: 'static/pos/products/beverage/coca.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'A001',
            type_id: 2,
            name: 'ABC Red',
            unit_price: 5000,
            image: 'static/pos/products/Alcohol/abcred.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'A002',
            type_id: 2,
            name: 'ABA Black',
            unit_price: 5000,
            image: 'static/pos/products/Alcohol/abc.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'A003',
            type_id: 2,
            name: 'Hanuman',
            unit_price: 4000,
            image: 'static/pos/products/Alcohol/hured.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'A004',
            type_id: 2,
            name: 'Hanuman Black',
            unit_price: 8000,
            image: 'static/pos/products/Alcohol/hunumanred.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'A005',
            type_id: 2,
            name: 'Hanuman',
            unit_price: 4000,
            image: 'static/pos/products/Alcohol/haa.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
        {
            code: 'F&M0010',
            type_id: 3,
            name: 'Pork',
            unit_price: 8000,
            image: 'static/pos/products/Alcohol/meat.png',
            creator_id: 1,
            discount: 0,
            recipes: [],
        },
    ],
};
