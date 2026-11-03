// currentUser when the cloud cannot be reached: a stored session stays logged in under the nickname
// last seen on this device (or the one in the session's metadata); no session is always a guest.

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { AuthRetryableFetchError } from '@supabase/supabase-js';
import { createAccountApi } from './accountApi';
import { cacheNickname } from './nicknameCache';
import { failed, makeFakeSupabase as makeFake, ok } from '../test/fakeSupabase';
import { AUTH_KEY, enumerateStore, storedSession } from '../test/storedSessionKit';

const offline = () => failed({ message: 'TypeError: Failed to fetch' });
const session = (meta: Record<string, unknown> = {}) => ok({ session: { user: { id: 'u9', user_metadata: meta } } });
const refreshFailed = () => failed(new AuthRetryableFetchError('Failed to fetch', 0));

describe('currentUser without the cloud', () => {
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
});
