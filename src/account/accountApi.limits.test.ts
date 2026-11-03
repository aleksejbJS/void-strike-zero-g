import { describe, it, expect, vi, afterEach } from 'vitest';
import { AuthApiError } from '@supabase/supabase-js';
import { createAccountApi, PASSWORD_MIN } from './accountApi';
import { failed, makeFakeSupabase as makeFake, ok } from '../test/fakeSupabase';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('password length', () => {
    it('exposes the minimum Supabase enforces by default', () => {
        expect(PASSWORD_MIN).toBe(6);
    });

    it('rejects a shorter password with weak_password before any request', async () => {
        const fake = makeFake();
        await expect(createAccountApi(fake.client).signUp('Alex', '12345')).rejects.toMatchObject({ code: 'weak_password' });
        expect(fake.auth.signUp).not.toHaveBeenCalled();
    });

    it('accepts a password of exactly the minimum length', async () => {
        const fake = makeFake();
        await createAccountApi(fake.client).signUp('Alex', '123456');
        expect(fake.auth.signUp).toHaveBeenCalledTimes(1);
    });

    it('checks the nickname first when both are wrong', async () => {
        const fake = makeFake();
        await expect(createAccountApi(fake.client).signUp('Al', '1')).rejects.toMatchObject({ code: 'invalid_nickname' });
    });

    it('does not apply the minimum on log in (old accounts, wrong guesses)', async () => {
        const fake = makeFake({ profile: ok({ nickname: 'Alex' }) });
        await createAccountApi(fake.client).logIn('Alex', '1');
        expect(fake.auth.signInWithPassword).toHaveBeenCalledTimes(1);
    });

    it('maps a weak_password rejection from Supabase', async () => {
        const fake = makeFake({ signUp: async () => failed(new AuthApiError('Password should be at least 6 characters.', 422, 'weak_password')) });
        await expect(createAccountApi(fake.client).signUp('Alex', 'secret1')).rejects.toMatchObject({ code: 'weak_password' });
    });
});

describe('rate limiting', () => {
    it('maps over_request_rate_limit to rate_limited', async () => {
        const fake = makeFake({ signUp: async () => failed(new AuthApiError('Request rate limit reached', 429, 'over_request_rate_limit')) });
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        await expect(createAccountApi(fake.client).signUp('Alex', 'secret1')).rejects.toMatchObject({ code: 'rate_limited' });
    });

    it('maps over_email_send_rate_limit to rate_limited', async () => {
        const fake = makeFake({ signUp: async () => failed(new AuthApiError('Email rate limit exceeded', 429, 'over_email_send_rate_limit')) });
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        await expect(createAccountApi(fake.client).signUp('Alex', 'secret1')).rejects.toMatchObject({ code: 'rate_limited' });
    });

    it('maps a bare HTTP 429 to rate_limited', async () => {
        const fake = makeFake({ signInWithPassword: async () => failed(new AuthApiError('Too many requests', 429, undefined)) });
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        await expect(createAccountApi(fake.client).logIn('Alex', 'secret1')).rejects.toMatchObject({ code: 'rate_limited' });
    });

    it('logs the rate limit so a developer can see it', async () => {
        const fake = makeFake({ signUp: async () => failed(new AuthApiError('Request rate limit reached', 429, 'over_request_rate_limit')) });
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await createAccountApi(fake.client).signUp('Alex', 'secret1').catch(() => undefined);
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('signUp'), expect.anything());
    });
});
