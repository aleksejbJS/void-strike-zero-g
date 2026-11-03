import { describe, it, expect, vi, afterEach } from 'vitest';

// Each case loads a fresh copy so its own module mocks apply to the dynamic imports.
async function loadModule() {
    vi.resetModules();
    return import('./loadAccountApi');
}

afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock('./supabaseClient');
    vi.restoreAllMocks();
});

describe('accountsConfigured', () => {
    it('needs both Supabase settings, ignoring blanks', async () => {
        const { accountsConfigured } = await loadModule();
        vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', '  ');
        expect(accountsConfigured()).toBe(false);
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
        expect(accountsConfigured()).toBe(true);
        vi.stubEnv('VITE_SUPABASE_URL', '');
        expect(accountsConfigured()).toBe(false);
    });
});

describe('loadAccountApi', () => {
    it('builds the api on the loaded client', async () => {
        vi.doMock('./supabaseClient', () => ({ getSupabase: () => ({}) }));
        const api = await (await loadModule()).loadAccountApi();
        expect(typeof api?.logIn).toBe('function');
    });

    it('is null when the client could not be created', async () => {
        vi.doMock('./supabaseClient', () => ({ getSupabase: () => null }));
        expect(await (await loadModule()).loadAccountApi()).toBeNull();
    });

    it('is null, with an error logged, when the code fails to load', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.doMock('./supabaseClient', () => { throw new Error('chunk failed to load'); });
        expect(await (await loadModule()).loadAccountApi()).toBeNull();
        expect(error).toHaveBeenCalledWith(expect.stringContaining('accounts are disabled'), expect.anything());
    });
});
