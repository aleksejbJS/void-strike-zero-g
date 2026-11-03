// The session on this device when the cloud cannot be reached. currentUser: a stored session stays logged
// in under the nickname last seen here (or the one in the session's metadata); no session is a guest.
// logOut: when the request fails, the stored session is removed from the device anyway.

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { AuthRetryableFetchError } from '@supabase/supabase-js';
import { createAccountApi } from './accountApi';
import { cacheNickname } from './nicknameCache';
import { failed, makeFakeSupabase as makeFake, ok } from '../test/fakeSupabase';
import { AUTH_KEY, enumerateStore, storedSession } from '../test/storedSessionKit';

const offline = () => failed({ message: 'TypeError: Failed to fetch' });
const session = (meta: Record<string, unknown> = {}) => ok({ session: { user: { id: 'u9', user_metadata: meta } } });
const refreshFailed = () => failed(new AuthRetryableFetchError('Failed to fetch', 0));

describe('the session without the cloud', () => {
    let store: Record<string, string>;
    let warn: Mock;
    let undoEnumerate: () => void;

    beforeEach(() => {
        store = {};
        const mocks = localStorage as unknown as Record<'getItem' | 'setItem' | 'removeItem', Mock>;
        mocks.getItem.mockReset().mockImplementation((key: string) => (key in store ? store[key] : null));
        mocks.setItem.mockReset().mockImplementation((key: string, value: string) => { store[key] = value; });
        mocks.removeItem.mockReset().mockImplementation((key: string) => { delete store[key]; });
        undoEnumerate = enumerateStore(store);
        warn = vi.spyOn(console, 'warn').mockImplementation(() => {}) as unknown as Mock;
    });
    afterEach(() => {
        undoEnumerate();
        vi.restoreAllMocks();
    });

    it('keeps the session logged in with the cached nickname when the nickname read fails', async () => {
        cacheNickname('u9', 'Alex');
        const fake = makeFake({ getSession: async () => session({ nickname: 'Old' }), profile: offline() });
        expect(await createAccountApi(fake.client).currentUser()).toEqual({ id: 'u9', nickname: 'Alex' });
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('u9'), expect.anything());
    });

    it('falls back to the nickname in the session metadata when nothing is cached', async () => {
        const fake = makeFake({ getSession: async () => session({ nickname: 'Alex' }), profile: offline() });
        expect(await createAccountApi(fake.client).currentUser()).toEqual({ id: 'u9', nickname: 'Alex' });
    });

    it('rejects (a guest, as before) when no nickname is known at all', async () => {
        const fake = makeFake({ getSession: async () => session(), profile: offline() });
        await expect(createAccountApi(fake.client).currentUser()).rejects.toMatchObject({ code: 'network' });
    });

    it('a cached nickname never logs anyone in without a session', async () => {
        cacheNickname('u9', 'Alex');
        const fake = makeFake();
        expect(await createAccountApi(fake.client).currentUser()).toBeNull();
        expect(fake.from).not.toHaveBeenCalled();
    });

    it('an expired token that cannot be refreshed offline still uses the stored session', async () => {
        cacheNickname('u9', 'Alex');
        store[AUTH_KEY] = storedSession('u9');
        const fake = makeFake({ getSession: async () => refreshFailed(), profile: offline() });
        expect(await createAccountApi(fake.client).currentUser()).toEqual({ id: 'u9', nickname: 'Alex' });
    });

    it('a failed refresh without a stored session still rejects', async () => {
        cacheNickname('u9', 'Alex');
        const fake = makeFake({ getSession: async () => refreshFailed() });
        await expect(createAccountApi(fake.client).currentUser()).rejects.toMatchObject({ code: 'network' });
    });

    it('logOut removes the stored session from this device when the request fails, and warns', async () => {
        store[AUTH_KEY] = storedSession('u9');
        store['sb-testref-auth-token-code-verifier'] = 'v';
        store.playerName = 'Alex';
        const fake = makeFake({ signOut: async () => ({ error: refreshFailed().error }) });

        await expect(createAccountApi(fake.client).logOut()).rejects.toMatchObject({ code: 'network' });

        expect(store[AUTH_KEY]).toBeUndefined();
        expect(store).toEqual({ 'sb-testref-auth-token-code-verifier': 'v', playerName: 'Alex' });
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('removed 1 stored session'), expect.anything());
    });

    it('logOut leaves storage to Supabase when the request succeeds', async () => {
        store[AUTH_KEY] = storedSession('u9');
        const fake = makeFake();
        await createAccountApi(fake.client).logOut();
        expect(store[AUTH_KEY]).toBeDefined(); // the fake signOut does not clear it; the real one does
    });
});
