import MyProfile from "@app/models/my-profile/my_profile.model";

export class MyProfileSeeder {

    public static async seed() {
        try {
            await MyProfileSeeder.seedMyProfile();
        } catch (error) {
            console.error('\x1b[31m\nError seeding my profile:', error);
        }
    }

    private static async seedMyProfile() {
        try {

            await MyProfile.bulkCreate(data.my_profile);

            console.log('\x1b[32mMy profile inserted successfully.');
        } catch (error) {
            console.error('Error seeding my profile:', error);
            throw error;
        }
    }
}

// Mock data for products and product types
const data = {
    my_profile: [
        {
            creator_id: 1,
            title: 'Mr.',
            first_name: 'Chan',
            last_name: 'Suvannet',
            phone: '0889566929',
            school: 'ITC',
            year: 5,
        },
        {
            creator_id: 2,
            title: 'Mr.',
            first_name: 'Soth',
            last_name: 'PichPanha',
            phone: '012345678',
            school: 'ITC',
            year: 2,
        }
    ]
};
