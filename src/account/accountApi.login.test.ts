// logIn when the nickname cannot be read right after a successful sign-in, the wider log-in rules for
// accounts registered before the whitelist, and onSessionEnded. Uses only the hand-made fake client
// (no runtime import of @supabase/supabase-js).

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { createAccountApi } from './accountApi';
import { failed, makeFakeSupabase as makeFake, ok } from '../test/fakeSupabase';
import { AUTH_KEY, enumerateStore, storedSession } from '../test/storedSessionKit';

const offline = () => failed({ message: 'TypeError: Failed to fetch' });
const signedIn = (meta: Record<string, unknown>) => async () => ok({ user: { id: 'u9', user_metadata: meta }, session: {} });

describe('logIn when the nickname cannot be read', () => {
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

    it('uses the nickname written at sign-up, and keeps the session', async () => {
        const fake = makeFake({ signInWithPassword: signedIn({ nickname: 'Alex' }), profile: offline() });
        expect(await createAccountApi(fake.client).logIn('alex', 'secret1')).toEqual({ id: 'u9', nickname: 'Alex' });
        expect(fake.auth.signOut).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('u9'), expect.anything());
    });

    it('without a usable nickname: ends the fresh session on this device, then rejects', async () => {
        const fake = makeFake({ signInWithPassword: signedIn({ nickname: 'x!' }), profile: offline() });
        await expect(createAccountApi(fake.client).logIn('Alex', 'secret1')).rejects.toMatchObject({ code: 'network' });
        expect(fake.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    });

    it('removes the stored session by hand when ending it fails too', async () => {
        store[AUTH_KEY] = storedSession('u9');
        const fake = makeFake({
            signInWithPassword: signedIn({}),
            profile: offline(),
            signOut: async () => ({ error: offline().error }),
        });
        await expect(createAccountApi(fake.client).logIn('Alex', 'secret1')).rejects.toMatchObject({ code: 'network' });
        expect(store[AUTH_KEY]).toBeUndefined();
    });
});

describe('nickname rules for sign-up and log-in', () => {
    afterEach(() => { vi.restoreAllMocks(); });

    it('an account named under the older, wider rules can still log in', async () => {
        const fake = makeFake({ profile: ok({ nickname: 'Élan' }) });
        expect(await createAccountApi(fake.client).logIn('élan', 'secret1')).toEqual({ id: 'u1', nickname: 'Élan' });
        expect(fake.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'nc3a96c616e@players.invalid', password: 'secret1' });
    });

    it('such a name can no longer be registered', async () => {
        const fake = makeFake();
        await expect(createAccountApi(fake.client).signUp('Élan', 'secret1')).rejects.toMatchObject({ code: 'invalid_nickname' });
        await expect(createAccountApi(fake.client).signUp('Ａlex', 'secret1')).rejects.toMatchObject({ code: 'invalid_nickname' });
        expect(fake.auth.signUp).not.toHaveBeenCalled();
    });
});

describe('onSessionEnded', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('reports SIGNED_OUT a moment later (outside the auth lock), and nothing else', async () => {
        const fake = makeFake();
        const listener = vi.fn();
        createAccountApi(fake.client).onSessionEnded(listener);
        fake.emitAuth('TOKEN_REFRESHED');
        fake.emitAuth('SIGNED_OUT');
        expect(listener).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(0);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('stops after the returned unsubscribe', async () => {
        const fake = makeFake();
        const listener = vi.fn();
        const stop = createAccountApi(fake.client).onSessionEnded(listener);
        stop();
        expect(fake.authListeners.size).toBe(0);
        fake.emitAuth('SIGNED_OUT');
        await vi.advanceTimersByTimeAsync(0);
        expect(listener).not.toHaveBeenCalled();
    });
});
