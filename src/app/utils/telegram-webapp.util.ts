import * as crypto from 'crypto';

export type TelegramWebAppUser = {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    language_code?: string;
};

export type TelegramWebAppInitData = {
    query_id?: string;
    user?: TelegramWebAppUser;
    auth_date?: number | string;
    hash?: string;
    [k: string]: unknown;
};

function parseInitData(initData: string): Record<string, string> {
    const out: Record<string, string> = {};
    const params = new URLSearchParams(initData);
    for (const [k, v] of params.entries()) {
        out[k] = v;
    }
    return out;
}

function dataCheckString(params: Record<string, string>, excludeKeys: Set<string>): string {
    const pairs: string[] = [];
    for (const k of Object.keys(params).sort()) {
        if (excludeKeys.has(k)) continue;
        pairs.push(`${k}=${params[k]}`);
    }
    return pairs.join('\n');
}

function hmacInitDataHash(botToken: string, dataCheckString: string): string {
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    return crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
}

/**
 * Verify Telegram WebApp `initData` signature.
 * Reference: Telegram "Validating data received via the Mini App".
 */
export function verifyTelegramWebAppInitData(initData: string, botToken: string): TelegramWebAppInitData {
    const rawInit = typeof initData === 'string' ? initData.trim() : '';
    if (!rawInit) {
        throw new Error('initData is required');
    }
    const token = (botToken || '').trim();
    if (!token) {
        throw new Error('Missing TELEGRAM_WEBAPP_BOT_TOKEN (or TELEGRAM_BOT_TOKEN) for Web App verification');
    }

    const params = parseInitData(rawInit);
    const providedHash = params['hash'];
    if (!providedHash) {
        throw new Error('initData hash is missing');
    }

    // Some clients send `signature` (Ed25519) alongside `hash` (HMAC). Telegram may or may not include
    // `signature` in the bot-token HMAC payload — accept either construction.
    const checkWithSignature = dataCheckString(params, new Set(['hash']));
    const checkWithoutSignature = dataCheckString(params, new Set(['hash', 'signature']));
    const computedA = hmacInitDataHash(token, checkWithSignature).toLowerCase();
    const computedB = hmacInitDataHash(token, checkWithoutSignature).toLowerCase();
    const want = providedHash.toLowerCase();
    if (computedA !== want && computedB !== want) {
        throw new Error('Invalid initData signature');
    }

    const userRaw = params['user'];
    const auth_date = params['auth_date'];
    let user: TelegramWebAppUser | undefined;
    if (userRaw) {
        try {
            user = JSON.parse(userRaw) as TelegramWebAppUser;
        } catch {
            user = undefined;
        }
    }

    return {
        query_id: params['query_id'],
        user,
        auth_date,
        hash: providedHash,
    };
}

// ============================================================================
// Telegram **Login Widget** (browser OAuth) — different signing scheme than
// Mini Apps. Reference: https://core.telegram.org/widgets/login#checking-authorization
// ----------------------------------------------------------------------------
// 1. Client sends back fields: `id`, `auth_date`, optional `first_name`,
//    `last_name`, `username`, `photo_url`, plus `hash`.
// 2. Build `data_check_string` from all received fields *except* `hash`,
//    sorted alphabetically and joined with `\n` as `key=value`.
// 3. Compute `secret = SHA256(bot_token)` (raw bytes) and compare
//    `HMAC-SHA256(secret, data_check_string)` (hex) to `hash`.
// 4. Reject if `auth_date` is older than `maxAgeSec` (defaults to 24h).
// ============================================================================

export type TelegramLoginWidgetPayload = {
    id: number | string;
    auth_date: number | string;
    hash: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    [k: string]: unknown;
};

export type VerifiedTelegramLoginUser = TelegramWebAppUser & {
    auth_date: number;
    photo_url?: string;
};

/** Verify a Telegram Login Widget payload and return the trusted user fields. */
export function verifyTelegramLoginWidgetPayload(
    payload: TelegramLoginWidgetPayload,
    botToken: string,
    options: { maxAgeSec?: number } = {},
): VerifiedTelegramLoginUser {
    const token = (botToken || '').trim();
    if (!token) {
        throw new Error('Missing TELEGRAM_WEBAPP_BOT_TOKEN (or TELEGRAM_BOT_TOKEN) for Telegram login verification');
    }
    if (!payload || typeof payload !== 'object') {
        throw new Error('Telegram login payload is missing.');
    }
    const providedHash = typeof payload.hash === 'string' ? payload.hash.trim().toLowerCase() : '';
    if (!providedHash) {
        throw new Error('Telegram login payload is missing the `hash` field.');
    }

    // Build the data_check_string from every scalar field except `hash`.
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(payload)) {
        if (k === 'hash') continue;
        if (v === null || v === undefined) continue;
        flat[k] = typeof v === 'string' ? v : String(v);
    }
    const dataCheckString = Object.keys(flat)
        .sort()
        .map((k) => `${k}=${flat[k]}`)
        .join('\n');

    const secret = crypto.createHash('sha256').update(token).digest();
    const computed = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex').toLowerCase();
    if (computed !== providedHash) {
        throw new Error('Invalid Telegram login signature.');
    }

    const authDate = Number(payload.auth_date);
    if (!Number.isFinite(authDate) || authDate <= 0) {
        throw new Error('Telegram login payload has an invalid `auth_date`.');
    }
    const maxAgeSec = options.maxAgeSec ?? 24 * 60 * 60;
    const ageSec = Math.floor(Date.now() / 1000) - authDate;
    if (ageSec > maxAgeSec) {
        throw new Error('Telegram login has expired — please sign in again.');
    }

    const idNum = Number(payload.id);
    if (!Number.isFinite(idNum) || idNum <= 0) {
        throw new Error('Telegram login payload has an invalid user id.');
    }

    return {
        id: idNum,
        first_name: typeof payload.first_name === 'string' ? payload.first_name : undefined,
        last_name: typeof payload.last_name === 'string' ? payload.last_name : undefined,
        username: typeof payload.username === 'string' ? payload.username : undefined,
        photo_url: typeof payload.photo_url === 'string' ? payload.photo_url : undefined,
        auth_date: authDate,
    };
}

