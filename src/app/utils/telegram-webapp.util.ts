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

