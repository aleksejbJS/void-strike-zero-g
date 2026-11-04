// Hand-rolled stand-in for the few SupabaseClient methods the account wrapper uses.
// Never touches the network; each method answers with what the test passes in.

import { vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

export type Result = { data: unknown; error: unknown };
export const ok = (data: unknown = null): Result => ({ data, error: null });
export const failed = (error: unknown): Result => ({ data: null, error });

export function makeFakeSupabase(over: Partial<{
    signUp: () => Promise<Result>;
    signInWithPassword: () => Promise<Result>;
    signOut: () => Promise<{ error: unknown }>;
    getSession: () => Promise<Result>;
    rpc: () => Promise<Result>;
    profile: Result;
    progress: Result;
    upsert: Result;
}> = {}) {
    // onAuthStateChange listeners; `emitAuth` plays an auth event to them, as Supabase would.
    const authListeners = new Set<(event: string) => void>();
    const emitAuth = (event: string): void => { for (const listener of [...authListeners]) listener(event); };
    const auth = {
        signUp: vi.fn(over.signUp ?? (async () => ok({ user: { id: 'u1' }, session: { access_token: 't' } }))),
        signInWithPassword: vi.fn(over.signInWithPassword ?? (async () => ok({ user: { id: 'u1' }, session: {} }))),
        signOut: vi.fn(over.signOut ?? (async () => ({ error: null }))),
        getSession: vi.fn(over.getSession ?? (async () => ok({ session: null }))),
        onAuthStateChange: vi.fn((listener: (event: string) => void) => {
            authListeners.add(listener);
            return { data: { subscription: { unsubscribe: () => { authListeners.delete(listener); } } } };
        }),
    };
    const rpc = vi.fn(over.rpc ?? (async () => ok(false)));
    const eq = vi.fn();
    const select = vi.fn();
    const upsert = vi.fn(async (_row: unknown) => over.upsert ?? ok());
    const from = vi.fn((table: string) => ({
        select: (cols: string) => {
            select(table, cols);
            return {
                eq: (col: string, val: unknown) => {
                    eq(col, val);
                    return { maybeSingle: async () => (table === 'profiles' ? over.profile : over.progress) ?? ok(null) };
                },
            };
        },
        upsert: (row: unknown) => upsert(row),
    }));
    const client = { auth, rpc, from } as unknown as SupabaseClient;
    return { client, auth, rpc, from, select, eq, upsert, emitAuth, authListeners };
}
