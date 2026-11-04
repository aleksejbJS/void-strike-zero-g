// The Supabase session on this device: reading it (with an offline fallback), ending it here, and
// hearing when it ends by itself. Only accountApi.ts uses this; the rest of the app sees AccountApi.

import type { SupabaseClient } from '@supabase/supabase-js';
import { toAccountError } from './accountError';
import { readStoredAuthUser, removeStoredAuthSessions, StoredAuthUser } from './storedAuth';

/** The user of the stored session, or null. Offline it falls back to the session kept on the device. */
export async function readSessionUser(client: SupabaseClient): Promise<StoredAuthUser | null> {
    try {
        const { data, error } = await client.auth.getSession(); // refreshes an expired token: needs the network
        if (error) throw error;
        return data.session?.user ?? null;
    } catch (error) {
        const failure = toAccountError(error, 'currentUser');
        // Supabase keeps the session when a refresh fails for want of a network (it drops it when the
        // server rejects it): stay logged in with it; requests refresh the token once online.
        const stored = failure.code === 'network' ? readStoredAuthUser() : null;
        if (!stored) throw failure;
        console.warn(`[account] could not refresh the session of user ${stored.id}, using the stored one`);
        return stored;
    }
}

/**
 * Forgets the session on this device. Not offline-safe: signOut first loads the session (refreshing an
 * expired token over the network). When it fails, the session could stay stored and come back on the next
 * start-up, so it is removed from this device by hand. Still rejects: the caller decides.
 */
export async function endLocalSession(client: SupabaseClient, label: string): Promise<void> {
    try {
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error) throw error;
    } catch (error) {
        const failure = toAccountError(error, label);
        const removed = removeStoredAuthSessions();
        console.warn(`[account] ${label} request failed; removed ${removed} stored session(s) from this device instead:`, failure);
        throw failure;
    }
}

/**
 * Calls `listener` whenever Supabase reports the session gone (SIGNED_OUT: our own logout, a refresh the
 * server refused, a logout in another tab). Returns the unsubscribe.
 */
export function watchSessionEnd(client: SupabaseClient, listener: () => void): () => void {
    try {
        const { data } = client.auth.onAuthStateChange(event => {
            // Supabase holds a lock while it runs this callback: anything that calls Supabase again
            // (the listener pushes progress) must run after it, or it would deadlock.
            if (event === 'SIGNED_OUT') setTimeout(listener, 0);
        });
        return () => data.subscription.unsubscribe();
    } catch (error) {
        console.error('[account] could not watch the session; a session that ends by itself is noticed on the next start-up:', error);
        return () => {};
    }
}
