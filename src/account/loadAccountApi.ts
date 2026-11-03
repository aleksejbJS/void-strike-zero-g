// Loads the Supabase-backed AccountApi on demand, so @supabase/supabase-js stays out of the app's
// first bundle: it is fetched only when the build has Supabase settings.

import type { AccountApi } from './accountApi';

const readEnv = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** True when the build has both Supabase settings; checked synchronously, before anything is loaded. */
export function accountsConfigured(): boolean {
    return readEnv(import.meta.env.VITE_SUPABASE_URL) !== '' && readEnv(import.meta.env.VITE_SUPABASE_ANON_KEY) !== '';
}

/** The account backend, or null when accounts cannot be used (no client, or its code failed to load). */
export async function loadAccountApi(): Promise<AccountApi | null> {
    try {
        const [{ getSupabase }, { createAccountApi }] = await Promise.all([
            import('./supabaseClient'),
            import('./accountApi'),
        ]);
        const client = getSupabase(); // settings are present, so null means createClient failed (it logs why)
        return client ? createAccountApi(client) : null;
    } catch (error) {
        console.error('[account] the account code could not be loaded, accounts are disabled:', error);
        return null;
    }
}
