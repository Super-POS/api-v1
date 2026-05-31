import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ensureSuperUserStaffRoles } from 'src/database/seeds/user/super-user-roles.patch';

@Injectable()
export class UserRoleSeedPatchService implements OnModuleInit {
    private readonly logger = new Logger(UserRoleSeedPatchService.name);

    async onModuleInit(): Promise<void> {
        try {
            await ensureSuperUserStaffRoles();
        } catch (e) {
            this.logger.warn(`super-user role patch: ${(e as Error).message}`);
        }
    }
}
