// =========================================================================>> Core Library
import { Injectable, Logger } from '@nestjs/common';

// =========================================================================>> Custom Library
import UsersLogs from '@app/models/user/user_logs.model';

export interface AuditDeviceInfo {
    ip?      : string;
    browser? : string;
    os?      : string;
    platform?: string;
}

@Injectable()
export class AuditLogService {

    private readonly logger = new Logger(AuditLogService.name);

    /**
     * Write an immutable audit record.
     * Never throws — audit logging must not disrupt the main request flow.
     */
    async log(
        actorId : number,
        action  : string,
        details : Record<string, unknown>,
        device? : AuditDeviceInfo,
    ): Promise<void> {
        try {
            await UsersLogs.create({
                user_id   : actorId,
                action,
                details   : JSON.stringify(details),
                ip_address: device?.ip       ?? null,
                browser   : device?.browser  ?? null,
                os        : device?.os       ?? null,
                platform  : device?.platform ?? null,
            });
        } catch (err) {
            // Log to console only — do not propagate
            this.logger.error(`Audit log failed [${action}]: ${err?.message}`);
        }
    }
}
