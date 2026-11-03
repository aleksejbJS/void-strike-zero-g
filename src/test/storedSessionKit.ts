// Makes the test localStorage mock enumerable (length / key) over a plain-object store, so code that
// scans keys (the stored Supabase session) sees what the test put there. Undo it after the test.

import { Mock } from 'vitest';

export const AUTH_KEY = 'sb-testref-auth-token';

/** A stored Supabase session the way supabase-js writes it (only the fields the app reads). */
export const storedSession = (userId: string, nickname?: string): string =>
    JSON.stringify({ access_token: 't', refresh_token: 'r', expires_at: 1, user: { id: userId, user_metadata: nickname ? { nickname } : {} } });

/** Backs localStorage.length and key() with `store`; returns a function that undoes it. */
export function enumerateStore(store: Record<string, string>): () => void {
    const ls = localStorage as unknown as { key: Mock };
    const lengthBefore = Object.getOwnPropertyDescriptor(localStorage, 'length');
    ls.key.mockReset().mockImplementation((i: number) => Object.keys(store)[i] ?? null);
    Object.defineProperty(localStorage, 'length', { configurable: true, get: () => Object.keys(store).length });
    return () => {
        ls.key.mockReset();
        if (lengthBefore) Object.defineProperty(localStorage, 'length', lengthBefore);
    };
}
