// What the UI can tell the player about a failed account call, and the mapping from
// whatever Supabase / fetch threw or returned into those few codes.

export type AccountErrorCode = 'taken' | 'bad_credentials' | 'invalid_nickname' | 'network';

export class AccountError extends Error {
    constructor(readonly code: AccountErrorCode, message: string = code) {
        super(message);
        this.name = 'AccountError';
    }
}

const ALREADY_REGISTERED_CODES = new Set(['user_already_exists', 'email_exists']);
const ALREADY_REGISTERED_MESSAGE = /already (been )?registered/i;
const BAD_CREDENTIALS_MESSAGE = /invalid login credentials/i;
// Browsers word a failed fetch differently: "Failed to fetch", "Load failed", "NetworkError ...".
const NETWORK_MESSAGE = /fetch|network|load failed|timed? ?out|abort/i;

const field = (source: object, key: string): string => {
    const value = (source as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : '';
};

/**
 * Turns anything thrown or returned as `error` into an AccountError.
 * Expected outcomes (taken, bad credentials, offline) pass quietly; an error nobody
 * anticipated is logged with its context and reported as `network` (retry later).
 */
export function toAccountError(error: unknown, context: string): AccountError {
    if (error instanceof AccountError) return error;

    const source = typeof error === 'object' && error !== null ? error : { message: String(error) };
    const message = field(source, 'message');
    const code = field(source, 'code');

    if (ALREADY_REGISTERED_CODES.has(code) || ALREADY_REGISTERED_MESSAGE.test(message)) {
        return new AccountError('taken', message);
    }
    if (code === 'invalid_credentials' || BAD_CREDENTIALS_MESSAGE.test(message)) {
        return new AccountError('bad_credentials', message);
    }
    if (field(source, 'name') === 'AuthRetryableFetchError' || NETWORK_MESSAGE.test(message)) {
        console.warn(`[account] ${context}: network problem`, error);
        return new AccountError('network', message);
    }

    console.error(`[account] ${context}: unexpected error`, error);
    return new AccountError('network', message);
}

/** Runs one account call; whatever it throws comes out as an AccountError. */
export async function guarded<T>(context: string, run: () => Promise<T>): Promise<T> {
    try {
        return await run();
    } catch (error) {
        throw toAccountError(error, context);
    }
}
