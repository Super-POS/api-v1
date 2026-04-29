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

function dataCheckString(params: Record<string, string>): string {
    const pairs: string[] = [];
    for (const k of Object.keys(params).sort()) {
        if (k === 'hash') continue;
        pairs.push(`${k}=${params[k]}`);
    }
    return pairs.join('\n');
}

/**
 * Verify Telegram WebApp `initData` signature.
 * Reference: Telegram "Validating data received via the Mini App".
 */
export function verifyTelegramWebAppInitData(initData: string, botToken: string): TelegramWebAppInitData {
    if (!initData || typeof initData !== 'string') {
        throw new Error('initData is required');
    }
    if (!botToken) {
        throw new Error('Missing TELEGRAM_BOT_TOKEN');
    }

    const params = parseInitData(initData);
    const providedHash = params['hash'];
    if (!providedHash) {
        throw new Error('initData hash is missing');
    }

    const checkString = dataCheckString(params);
    // Mini App spec: secret_key = HMAC_SHA256(key "WebAppData", data = bot_token) — not SHA256(bot_token).
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computed = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

    if (computed.toLowerCase() !== providedHash.toLowerCase()) {
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

