import { RoleEnum } from '@app/enums/role.enum';
import User from '@app/models/user/user.model';
import UserRoles from '@app/models/user/user_roles.model';

/** ERP owner can switch Admin / Cashier / Super User via Change rights. */
export const SUPER_USER_ACCOUNT_EMAIL = 'superuser@pos.com';

const SUPER_USER_STAFF_ROLES: { role_id: RoleEnum; is_default: boolean }[] = [
    { role_id: RoleEnum.SUPER_USER, is_default: true },
    { role_id: RoleEnum.ADMIN,      is_default: false },
    { role_id: RoleEnum.CASHIER,    is_default: false },
];

/**
 * Ensures the ERP owner account has Admin + Cashier + Super User roles.
 * Safe to run on every startup or via `npm run seed:user-roles`.
 */
export async function ensureSuperUserStaffRoles(): Promise<void> {
    const user = await User.findOne({ where: { email: SUPER_USER_ACCOUNT_EMAIL } });
    if (!user) {
        return;
    }

    for (const { role_id, is_default } of SUPER_USER_STAFF_ROLES) {
        await UserRoles.findOrCreate({
            where: { user_id: user.id, role_id },
            defaults: {
                user_id    : user.id,
                role_id,
                added_id   : 1,
                is_default,
                created_at : new Date(),
            },
        });
    }

    const defaultCount = await UserRoles.count({
        where: { user_id: user.id, is_default: true },
    });
    if (defaultCount === 0) {
        await UserRoles.update(
            { is_default: false },
            { where: { user_id: user.id } },
        );
        await UserRoles.update(
            { is_default: true },
            { where: { user_id: user.id, role_id: RoleEnum.SUPER_USER } },
        );
    }
}
