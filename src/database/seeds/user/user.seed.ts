import { RoleEnum } from "@app/enums/role.enum";

import Role from "src/app/models/user/role.model";
import UserRoles from "src/app/models/user/user_roles.model";
import User from "src/app/models/user/user.model";

export class UserSeeder {

    public static seed = async () => {
        try {
            
            await UserSeeder.seedRoles();
            await UserSeeder.seedUsers();
            await UserSeeder.seedUserRoles();

        } catch (error) {
            // console.error('\x1b[31m\nError seeding data user:', error);
        }
    }

    private static async seedRoles() {
        try {
            
            await Role.bulkCreate(data.roles);
            console.log('\x1b[32mRoles data inserted successfully.');

        } catch (error) {

            console.error('\x1b[31m\nError seeding roles:', error);
            throw error;

        }
    }

    private static async seedUsers() {
        try {
            await User.bulkCreate(data.users);
            console.log('\x1b[32mUsers data inserted successfully.');
        } catch (error) {
            console.error('Error seeding users:', error);
            throw error;
        }
    }

    private static async seedUserRoles() {
        try {
            await UserRoles.bulkCreate(data.user_roles);
            console.log('\x1b[32mUser Roles data inserted successfully.');
        } catch (error) {
            console.error('Error seeding user roles:', error);
            throw error;
        }
    }

}

// Mock-data
const data = {
    roles: [
        { name: 'Administrator', slug: 'admin' },    // id: 1
        { name: 'Cashier', slug: 'cashier' },       // id: 2
        { name: 'Customer', slug: 'customer' },    // id: 3
    ],
    users: [
        // ── Staff ────────────────────────────────────────────────────────────
        // id: 1  (admin + cashier)
        {
            name      : 'Chansuvannet Net',
            phone     : '0889566929',
            email     : 'chansuvannet999@gmail.com',
            password  : '123456',
            avatar    : 'static/pos/user/avatar.png',
            creator_id: 1,
            created_at: new Date(),
            updated_at: new Date(),
        },
        // id: 2  (cashier)
        {
            name      : 'Heng Tongsour',
            phone     : '0889566930',
            email     : 'hengtongsour@gmail.com',
            password  : '123456',
            avatar    : 'static/pos/user/avatar.png',
            creator_id: 1,
            created_at: new Date(),
            updated_at: new Date(),
        },
        // id: 3  (cashier)
        {
            name      : 'ENG SOKCHHENG',
            phone     : '012894154',
            email     : 'engsokchheng@gmail.com',
            password  : '123456',
            avatar    : 'static/pos/user/avatar.png',
            creator_id: 1,
            created_at: new Date(),
            updated_at: new Date(),
        },
        // ── Customers ────────────────────────────────────────────────────────
        // id: 4
        {
            name      : 'Sok Dara',
            phone     : '0971234567',
            email     : 'sokdara@gmail.com',
            password  : '123456',
            avatar    : 'static/pos/user/avatar.png',
            creator_id: 1,
            created_at: new Date(),
            updated_at: new Date(),
        },
        // id: 5
        {
            name      : 'Chan Srey',
            phone     : '0857654321',
            email     : 'chansrey@gmail.com',
            password  : '123456',
            avatar    : 'static/pos/user/avatar.png',
            creator_id: 1,
            created_at: new Date(),
            updated_at: new Date(),
        },
        // id: 6
        {
            name      : 'Lim Sopheap',
            phone     : '0761239999',
            email     : 'limsopheap@gmail.com',
            password  : '123456',
            avatar    : 'static/pos/user/avatar.png',
            creator_id: 1,
            created_at: new Date(),
            updated_at: new Date(),
        },
        // id: 7
        {
            name      : 'Dara Kosal',
            phone     : '0789012345',
            email     : 'darakosal@gmail.com',
            password  : '123456',
            avatar    : 'static/pos/user/avatar.png',
            creator_id: 1,
            created_at: new Date(),
            updated_at: new Date(),
        },
        // id: 8
        {
            name      : 'Sreyla Meng',
            phone     : '0912345678',
            email     : 'sreylameng@gmail.com',
            password  : '123456',
            avatar    : 'static/pos/user/avatar.png',
            creator_id: 1,
            created_at: new Date(),
            updated_at: new Date(),
        },
    ],
    user_roles: [
        // ── Staff roles ──────────────────────────────────────────────────────
        { user_id: 1, role_id: RoleEnum.ADMIN,    added_id: 1, created_at: new Date(), is_default: true  },
        { user_id: 1, role_id: RoleEnum.CASHIER,  added_id: 1, created_at: new Date(), is_default: false },
        { user_id: 2, role_id: RoleEnum.CASHIER,  added_id: 1, created_at: new Date(), is_default: true  },
        { user_id: 3, role_id: RoleEnum.CASHIER,  added_id: 1, created_at: new Date(), is_default: true  },
        // ── Customer roles ───────────────────────────────────────────────────
        { user_id: 4, role_id: RoleEnum.CUSTOMER, added_id: 1, created_at: new Date(), is_default: true  },
        { user_id: 5, role_id: RoleEnum.CUSTOMER, added_id: 1, created_at: new Date(), is_default: true  },
        { user_id: 6, role_id: RoleEnum.CUSTOMER, added_id: 1, created_at: new Date(), is_default: true  },
        { user_id: 7, role_id: RoleEnum.CUSTOMER, added_id: 1, created_at: new Date(), is_default: true  },
        { user_id: 8, role_id: RoleEnum.CUSTOMER, added_id: 1, created_at: new Date(), is_default: true  },
    ],
};

