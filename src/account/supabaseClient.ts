// The one shared Supabase client. Returns null (accounts disabled) when the build has no Supabase
// settings, so the game keeps working as guest-only. The anon key is public by design: the
// database is protected by Row Level Security, not by hiding the key.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createTimeoutFetch } from './timeoutFetch';

let cached: SupabaseClient | null | undefined;

const readEnv = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export function getSupabase(): SupabaseClient | null {
    if (cached !== undefined) return cached;

    const url = readEnv(import.meta.env.VITE_SUPABASE_URL);
    const anonKey = readEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);
    if (!url || !anonKey) {
        cached = null; // Not an error: the owner has not set accounts up (yet).
        return cached;
    }

    try {
        cached = createClient(url, anonKey, {
            // No OAuth or e-mail links, and the app uses #hash routes: never parse the URL for a session.
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
            // Every request (auth, tables, rpc) gives up after a while instead of hanging.
            global: { fetch: createTimeoutFetch() },
        });
    } catch (error) {
        console.error('[account] Supabase client could not be created, accounts are disabled. Check VITE_SUPABASE_URL.', error);
        cached = null;
    }
    return cached;
}
