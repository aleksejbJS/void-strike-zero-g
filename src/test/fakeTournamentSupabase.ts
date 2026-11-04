// Hand-rolled stand-in for the SupabaseClient methods the tournament wrappers use: rpc(), from().select()
// chains and Realtime channels. Never touches the network; each table answers with what the test passes in.

import { vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

export type Result = { data: unknown; error: unknown };
export const ok = (data: unknown = null): Result => ({ data, error: null });
export const failed = (error: unknown): Result => ({ data: null, error });

type Call = [method: string, ...args: unknown[]];
export type ChannelStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';

export interface FakeChannel {
    name: string;
    filters: Array<{ table: string; filter: string; event: string }>;
    emitChange: (table?: string) => void;
    setStatus: (status: ChannelStatus) => void;
}

export function makeFakeTournamentSupabase() {
    const rpcResults: Result[] = [];
    const tables: Record<string, Result> = {};
    const queries: Array<{ table: string; calls: Call[] }> = [];
    const channels: FakeChannel[] = [];

    const rpc = vi.fn(async (_name: string, _params: Record<string, unknown>) => rpcResults.shift() ?? ok(null));

    const from = vi.fn((table: string) => {
        const calls: Call[] = [];
        queries.push({ table, calls });
        const answer = () => tables[table] ?? ok([]);
        const chain: Record<string, unknown> = {};
        for (const method of ['select', 'eq', 'in', 'or', 'order']) {
            chain[method] = (...args: unknown[]) => { calls.push([method, ...args]); return chain; };
        }
        chain.maybeSingle = async () => { calls.push(['maybeSingle']); return answer(); };
        chain.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(answer()).then(resolve, reject);
        return chain;
    });

    const channel = vi.fn((name: string) => {
        const handlers: Array<{ table: string; callback: () => void }> = [];
        let onStatus: (status: string) => void = () => {};
        const fake: FakeChannel = {
            name,
            filters: [],
            emitChange: (table) => handlers.filter((h) => !table || h.table === table).forEach((h) => h.callback()),
            setStatus: (status) => onStatus(status),
        };
        const handle = {
            on: (_type: string, filter: { table: string; filter: string; event: string }, callback: () => void) => {
                fake.filters.push(filter);
                handlers.push({ table: filter.table, callback });
                return handle;
            },
            subscribe: (callback: (status: string) => void) => { onStatus = callback; return handle; },
        };
        channels.push(fake);
        return handle;
    });
    const removeChannel = vi.fn(async (_channel: unknown) => 'ok');

    const client = { rpc, from, channel, removeChannel } as unknown as SupabaseClient;
    return { client, rpc, from, channel, removeChannel, rpcResults, tables, queries, channels };
}
