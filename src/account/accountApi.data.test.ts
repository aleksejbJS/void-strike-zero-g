import { describe, it, expect, vi, afterEach } from 'vitest';
import { AccountError, createAccountApi } from './accountApi';
import { PlayerSnapshot } from './snapshot';
import { failed, makeFakeSupabase as makeFake, ok } from '../test/fakeSupabase';

const snapshot: PlayerSnapshot = { achievements: { killer: { progress: 3, unlocked: false } }, xp: 40, look: null, stats: { kills: 6 } };

afterEach(() => {
    vi.restoreAllMocks();
});

describe('isNicknameTaken', () => {
    it('is false without a request for a nickname that fails validation', async () => {
        const fake = makeFake();
        expect(await createAccountApi(fake.client).isNicknameTaken('Alex!')).toBe(false);
        expect(fake.rpc).not.toHaveBeenCalled();
    });

    it('asks nickname_taken with the nickname key', async () => {
        const fake = makeFake({ rpc: async () => ok(true) });
        expect(await createAccountApi(fake.client).isNicknameTaken(' Alex ')).toBe(true);
        expect(fake.rpc).toHaveBeenCalledWith('nickname_taken', { nick_key: 'alex' });
    });

    it('is false when the name is free', async () => {
        const fake = makeFake({ rpc: async () => ok(false) });
        expect(await createAccountApi(fake.client).isNicknameTaken('Alex')).toBe(false);
    });

    it('surfaces an rpc failure so the caller can let the guest through', async () => {
        const fake = makeFake({ rpc: async () => failed({ message: 'TypeError: Failed to fetch' }) });
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        await expect(createAccountApi(fake.client).isNicknameTaken('Alex')).rejects.toMatchObject({ code: 'network' });
    });
});

describe('fetchSnapshot', () => {
    it('is null when the user has no row yet', async () => {
        const fake = makeFake({ progress: ok(null) });
        expect(await createAccountApi(fake.client).fetchSnapshot('u1')).toBeNull();
        expect(fake.select).toHaveBeenCalledWith('player_progress', 'data');
        expect(fake.eq).toHaveBeenCalledWith('user_id', 'u1');
    });

    it('sanitizes garbage stored in data', async () => {
        const fake = makeFake({ progress: ok({ data: { achievements: 'x', xp: -5, look: 7 } }) });
        expect(await createAccountApi(fake.client).fetchSnapshot('u1')).toEqual({ achievements: {}, xp: 0, look: null, stats: {} });
    });

    it('returns a valid stored snapshot unchanged', async () => {
        const fake = makeFake({ progress: ok({ data: snapshot }) });
        expect(await createAccountApi(fake.client).fetchSnapshot('u1')).toEqual(snapshot);
    });

    it('surfaces a query error', async () => {
        const fake = makeFake({ progress: failed({ message: 'TypeError: Failed to fetch' }) });
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        await expect(createAccountApi(fake.client).fetchSnapshot('u1')).rejects.toMatchObject({ code: 'network' });
    });
});

describe('saveSnapshot', () => {
    it('upserts user_id, data and an ISO updated_at', async () => {
        const fake = makeFake();
        await createAccountApi(fake.client).saveSnapshot('u1', snapshot);
        expect(fake.from).toHaveBeenCalledWith('player_progress');
        const row = fake.upsert.mock.calls[0][0] as { user_id: string; data: unknown; updated_at: string };
        expect(row.user_id).toBe('u1');
        expect(row.data).toEqual(snapshot);
        expect(new Date(row.updated_at).toISOString()).toBe(row.updated_at);
    });

    it('surfaces an upsert error', async () => {
        const fake = makeFake({ upsert: failed({ message: 'new row violates row-level security policy', code: '42501' }) });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        await expect(createAccountApi(fake.client).saveSnapshot('u1', snapshot)).rejects.toBeInstanceOf(AccountError);
    });
});
