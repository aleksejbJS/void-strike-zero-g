import { describe, it, expect, vi, afterEach } from 'vitest';
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { AccountError, createAccountApi } from './accountApi';
import { nicknameToEmail } from './nickname';
import { failed, makeFakeSupabase as makeFake, ok } from '../test/fakeSupabase';

const alexProfile = ok({ nickname: 'Alex' });

afterEach(() => {
    vi.restoreAllMocks();
});

describe('signUp', () => {
    it('sends the encoded email and trigger metadata for the normalized nickname', async () => {
        const fake = makeFake();
        const user = await createAccountApi(fake.client).signUp(' Alex ', 'secret1');
        expect(fake.auth.signUp).toHaveBeenCalledWith({
            email: nicknameToEmail('Alex'),
            password: 'secret1',
            options: { data: { nickname: 'Alex', nickname_key: 'alex' } },
        });
        expect(user).toEqual({ id: 'u1', nickname: 'Alex' });
    });

    it('rejects an invalid nickname without calling the client', async () => {
        const fake = makeFake();
        // Cyrillic A + Latin "lex": mixed scripts
        await expect(createAccountApi(fake.client).signUp('Аlex', 'secret1')).rejects.toMatchObject({ code: 'invalid_nickname' });
        expect(fake.auth.signUp).not.toHaveBeenCalled();
    });

    it('maps "User already registered" to taken', async () => {
        const fake = makeFake({ signUp: async () => failed(new AuthApiError('User already registered', 422, 'user_already_exists')) });
        const err = await createAccountApi(fake.client).signUp('Alex', 'secret1').catch((e: unknown) => e);
        expect(err).toBeInstanceOf(AccountError);
        expect(err).toMatchObject({ code: 'taken' });
    });

    it('maps a plain "User already registered" message to taken', async () => {
        const fake = makeFake({ signUp: async () => failed({ message: 'User already registered' }) });
        await expect(createAccountApi(fake.client).signUp('Alex', 'secret1')).rejects.toMatchObject({ code: 'taken' });
    });

    it('maps a thrown fetch failure to network', async () => {
        const fake = makeFake({ signUp: async () => { throw new TypeError('Failed to fetch'); } });
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        await expect(createAccountApi(fake.client).signUp('Alex', 'secret1')).rejects.toMatchObject({ code: 'network' });
    });

    it('maps a retryable fetch error returned by auth to network', async () => {
        const fake = makeFake({ signUp: async () => failed(new AuthRetryableFetchError('fetch failed', 0)) });
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        await expect(createAccountApi(fake.client).signUp('Alex', 'secret1')).rejects.toMatchObject({ code: 'network' });
    });

    it('treats a sign-up without a session as network and names the Supabase setting', async () => {
        const fake = makeFake({ signUp: async () => ok({ user: { id: 'u1' }, session: null }) });
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        await expect(createAccountApi(fake.client).signUp('Alex', 'secret1')).rejects.toMatchObject({ code: 'network' });
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('Confirm email'));
    });

    it('logs and reports network for an unexpected auth error', async () => {
        const fake = makeFake({ signUp: async () => failed(new AuthApiError('Database error saving new user', 500, 'unexpected_failure')) });
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        await expect(createAccountApi(fake.client).signUp('Alex', 'secret1')).rejects.toMatchObject({ code: 'network' });
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('signUp'), expect.anything());
    });
});

describe('logIn', () => {
    it('signs in with the encoded email and returns the display nickname from profiles', async () => {
        const fake = makeFake({ profile: alexProfile });
        const user = await createAccountApi(fake.client).logIn('  aLEX', 'secret1');
        expect(fake.auth.signInWithPassword).toHaveBeenCalledWith({ email: nicknameToEmail('alex'), password: 'secret1' });
        expect(fake.select).toHaveBeenCalledWith('profiles', 'nickname');
        expect(fake.eq).toHaveBeenCalledWith('id', 'u1');
        expect(user).toEqual({ id: 'u1', nickname: 'Alex' });
    });

    it('maps invalid credentials to bad_credentials', async () => {
        const fake = makeFake({ signInWithPassword: async () => failed(new AuthApiError('Invalid login credentials', 400, 'invalid_credentials')) });
        await expect(createAccountApi(fake.client).logIn('Alex', 'wrong')).rejects.toMatchObject({ code: 'bad_credentials' });
    });

    it('reports bad_credentials for a nickname that cannot exist, without a request', async () => {
        const fake = makeFake();
        await expect(createAccountApi(fake.client).logIn('Al', 'secret1')).rejects.toMatchObject({ code: 'bad_credentials' });
        expect(fake.auth.signInWithPassword).not.toHaveBeenCalled();
    });

    it('fails with network when the profile row is missing', async () => {
        const fake = makeFake({ profile: ok(null) });
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        await expect(createAccountApi(fake.client).logIn('Alex', 'secret1')).rejects.toMatchObject({ code: 'network' });
        expect(spy).toHaveBeenCalled();
    });
});

describe('logOut', () => {
    it('signs out of this device only', async () => {
        const fake = makeFake();
        await createAccountApi(fake.client).logOut();
        expect(fake.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    });

    it('surfaces a sign-out failure', async () => {
        const fake = makeFake({ signOut: async () => ({ error: new Error('boom') }) });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await expect(createAccountApi(fake.client).logOut()).rejects.toBeInstanceOf(AccountError);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('logout request failed'), expect.anything());
    });
});

describe('currentUser', () => {
    it('is null when there is no session', async () => {
        const fake = makeFake();
        expect(await createAccountApi(fake.client).currentUser()).toBeNull();
        expect(fake.from).not.toHaveBeenCalled();
    });

    it('returns the id and display nickname of the stored session', async () => {
        const fake = makeFake({ getSession: async () => ok({ session: { user: { id: 'u9' } } }), profile: alexProfile });
        expect(await createAccountApi(fake.client).currentUser()).toEqual({ id: 'u9', nickname: 'Alex' });
        expect(fake.eq).toHaveBeenCalledWith('id', 'u9');
    });

    it('surfaces a failed session refresh as an AccountError', async () => {
        const fake = makeFake({ getSession: async () => failed(new AuthRetryableFetchError('Failed to fetch', 0)) });
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        await expect(createAccountApi(fake.client).currentUser()).rejects.toMatchObject({ code: 'network' });
    });
});

