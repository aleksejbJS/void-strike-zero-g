// Direct access to the session Supabase keeps in localStorage under "sb-<project ref>-auth-token".
// Used only as a fallback when the network is down: to see who is logged in when the session cannot
// be refreshed, and to forget the session when the logout request fails.

const AUTH_TOKEN_KEY = /^sb-.+-auth-token$/;

export interface StoredAuthUser { id: string; user_metadata?: Record<string, unknown> }

const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

function authTokenKeys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key !== null && AUTH_TOKEN_KEY.test(key)) keys.push(key);
    }
    return keys;
}

/** The user of the one session stored on this device; null when there is none, several, or it is unreadable. */
export function readStoredAuthUser(): StoredAuthUser | null {
    try {
        const keys = authTokenKeys();
        if (keys.length !== 1) return null;
        const raw = localStorage.getItem(keys[0]);
        const parsed: unknown = raw === null ? null : JSON.parse(raw);
        const user = isRecord(parsed) ? parsed.user : null;
        if (!isRecord(user) || typeof user.id !== 'string' || user.id === '') return null;
        return { id: user.id, user_metadata: isRecord(user.user_metadata) ? user.user_metadata : undefined };
    } catch (error) {
        console.warn('[account] could not read the stored session:', error);
        return null;
    }
}

