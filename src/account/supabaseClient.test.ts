import { describe, it, expect, vi, afterEach } from 'vitest';

// The client is cached per module instance, so every case loads a fresh copy after stubbing env.
async function loadGetSupabase() {
    vi.resetModules();
    return (await import('./supabaseClient')).getSupabase;
}

afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe('getSupabase', () => {
    it('is null when both variables are missing', async () => {
        vi.stubEnv('VITE_SUPABASE_URL', '');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
        expect((await loadGetSupabase())()).toBeNull();
    });

    it('is null when only the URL is set', async () => {
        vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', '   ');
        expect((await loadGetSupabase())()).toBeNull();
    });

    it('is null when only the key is set', async () => {
        vi.stubEnv('VITE_SUPABASE_URL', '');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
        expect((await loadGetSupabase())()).toBeNull();
    });

    it('is null, not a throw, when the URL is malformed', async () => {
        vi.stubEnv('VITE_SUPABASE_URL', 'not a url');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect((await loadGetSupabase())()).toBeNull();
        expect(spy).toHaveBeenCalled();
    });

    it('returns one shared client when both variables are set', async () => {
        vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
        const getSupabase = await loadGetSupabase();
        const client = getSupabase();
        expect(client).not.toBeNull();
        expect(getSupabase()).toBe(client);
    });

    it('gives the client a fetch that times out', async () => {
        vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
        const createClient = vi.fn(() => ({}));
        vi.doMock('@supabase/supabase-js', () => ({ createClient }));
        try {
            (await loadGetSupabase())();
            expect(createClient).toHaveBeenCalledWith('https://example.supabase.co', 'anon-key',
                expect.objectContaining({ global: { fetch: expect.any(Function) } }));
        } finally {
            vi.doUnmock('@supabase/supabase-js');
        }
    });
});
