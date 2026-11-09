import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { ALEX, installAccountHarness, networkError, snap } from '../test/accountHarness';
import { AccountError } from './accountError';
import { useAccount } from './useAccount';

describe('AccountProvider start-up', () => {
    const h = installAccountHarness();
    afterEach(() => { vi.unstubAllEnvs(); });

    it('is disabled when the api is explicitly null', async () => {
        h.mount(null);
        expect(h.account().status).toBe('disabled');
        await h.settle();
        expect(h.account()).toMatchObject({ status: 'disabled', nickname: null });
    });

    it('is disabled straight away without Supabase settings', async () => {
        vi.stubEnv('VITE_SUPABASE_URL', '');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
        h.mountFromEnv();
        expect(h.account().status).toBe('disabled');
        await h.settle();
        expect(h.account().status).toBe('disabled');
    });

    it('is a guest when nobody is logged in, without touching the cloud', async () => {
        h.mount();
        expect(h.account().status).toBe('loading');
        await h.settle();
        expect(h.account()).toMatchObject({ status: 'guest', nickname: null });
        expect(h.api.fetchSnapshot).not.toHaveBeenCalled();
    });

    it('is a guest with local data untouched when the session cannot be checked', async () => {
        h.store.fighterXp = '50';
        h.store.playerName = 'Zed';
        h.api.currentUser.mockRejectedValue(networkError());
        h.mount();
        await h.settle();
        expect(h.account().status).toBe('guest');
        expect(h.warn).toHaveBeenCalled();
        expect(h.store).toMatchObject({ fighterXp: '50', playerName: 'Zed' });
        expect(h.api.fetchSnapshot).not.toHaveBeenCalled();
    });

    it('restores a stored session: pulls the cloud, uses the account nickname', async () => {
        h.store.playerName = 'Zed';
        h.store.lifetimeStats = '{}'; // counters already stored (none yet), so the cloud copy lacks nothing
        h.api.currentUser.mockResolvedValue(ALEX);
        h.api.fetchSnapshot.mockResolvedValue(snap(300));
        h.mount();
        await h.settle();
        expect(h.account()).toMatchObject({ status: 'loggedIn', nickname: 'Alex' });
        expect(h.store).toMatchObject({ playerName: 'Alex', fighterXp: '300' });
        expect(h.ui().playerName).toBe('Alex');
        expect(h.api.fetchSnapshot).toHaveBeenCalledTimes(1); // StrictMode's discarded first run did not pull
    });

    it('restores a session with progress left unsent at its last logout: merged and pushed', async () => {
        h.store[`accountPending:${ALEX.id}`] = JSON.stringify(snap(70));
        h.api.currentUser.mockResolvedValue(ALEX);
        h.api.fetchSnapshot.mockResolvedValue(snap(10));
        h.mount();
        await h.settle();
        expect(h.account().status).toBe('loggedIn');
        expect(h.store.fighterXp).toBe('70');
        expect(h.savedFor(ALEX.id).at(-1)?.xp).toBe(70);
        expect(h.store[`accountPending:${ALEX.id}`]).toBeUndefined();
    });
});

describe('AccountProvider logIn / signUp', () => {
    const h = installAccountHarness();

    it('logs in: status, nickname, stored player name and UI name', async () => {
        h.mount();
        await h.settle();
        await act(async () => { await h.account().logIn('alex', 'secret'); });
        expect(h.api.logIn).toHaveBeenCalledWith('alex', 'secret');
        expect(h.account()).toMatchObject({ status: 'loggedIn', nickname: 'Alex' });
        expect(h.store.playerName).toBe('Alex');
        expect(h.ui().playerName).toBe('Alex');
    });

    it('merges cloud progress into local on login, never lowering it', async () => {
        h.store.fighterXp = '40';
        h.api.fetchSnapshot.mockResolvedValue(snap(500));
        h.mount();
        await h.settle();
        await act(async () => { await h.account().logIn('Alex', 'secret'); });
        expect(h.store.fighterXp).toBe('500');
    });

    it('rejects with the AccountError and stays a guest when login fails', async () => {
        h.store.playerName = 'Zed';
        h.api.logIn.mockRejectedValue(new AccountError('bad_credentials'));
        h.mount();
        await h.settle();
        await act(async () => {
            await expect(h.account().logIn('Alex', 'nope')).rejects.toMatchObject({ code: 'bad_credentials' });
        });
        expect(h.account()).toMatchObject({ status: 'guest', nickname: null });
        expect(h.store.playerName).toBe('Zed');
        expect(h.api.fetchSnapshot).not.toHaveBeenCalled();
    });

    it('signs up and uploads the guest progress into the new account', async () => {
        h.store.fighterXp = '40';
        h.mount();
        await h.settle();
        await act(async () => { await h.account().signUp('Alex', 'secret'); });
        expect(h.api.signUp).toHaveBeenCalledWith('Alex', 'secret');
        expect(h.account()).toMatchObject({ status: 'loggedIn', nickname: 'Alex' });
        expect(h.savedFor(ALEX.id).map(s => s.xp)).toEqual([40]);
    });

    it('rejects a taken nickname on sign-up and stays a guest', async () => {
        h.api.signUp.mockRejectedValue(new AccountError('taken'));
        h.mount();
        await h.settle();
        await act(async () => {
            await expect(h.account().signUp('Alex', 'secret')).rejects.toBeInstanceOf(AccountError);
        });
        expect(h.account().status).toBe('guest');
    });

    it('passes the taken-name check through, rejection included', async () => {
        h.mount();
        await h.settle();
        h.api.isNicknameTaken.mockResolvedValueOnce(true);
        await expect(h.account().isNicknameTaken('Alex')).resolves.toBe(true);
        h.api.isNicknameTaken.mockRejectedValueOnce(networkError());
        await expect(h.account().isNicknameTaken('Alex')).rejects.toMatchObject({ code: 'network' });
        expect(h.api.isNicknameTaken).toHaveBeenCalledWith('Alex');
    });
});

describe('useAccount', () => {
    it('throws a clear error outside AccountProvider', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const Orphan: React.FC = () => { useAccount(); return null; };
        expect(() => render(<Orphan />)).toThrow(/AccountProvider/);
        error.mockRestore();
    });
});
