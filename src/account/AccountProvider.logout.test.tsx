import { describe, it, expect } from 'vitest';
import { act } from '@testing-library/react';
import { ALEX, BO, installAccountHarness, networkError, snap } from '../test/accountHarness';

const PENDING_ALEX = `accountPending:${ALEX.id}`;

describe('AccountProvider logOut', () => {
    const h = installAccountHarness();

    async function loggedInWithXp(xp: number): Promise<void> {
        h.mount();
        await h.settle();
        await h.loginAs(ALEX);
        h.store.fighterXp = String(xp);
    }
    const logOut = () => act(async () => { await h.account().logOut(); });

    it('saves the last progress, then leaves a clean guest', async () => {
        await loggedInWithXp(70);
        await logOut();
        expect(h.savedFor(ALEX.id).at(-1)?.xp).toBe(70);
        expect(h.api.logOut).toHaveBeenCalledTimes(1);
        expect(h.account()).toMatchObject({ status: 'guest', nickname: null });
        expect(h.store.fighterXp).toBeUndefined();
        expect(h.store.playerName).toBeUndefined();
        expect(h.store[PENDING_ALEX]).toBeUndefined();
        expect(h.ui().playerName).toBe('Anonymous');
    });

    it('keeps unsent progress on the device for that account when the last push fails', async () => {
        await loggedInWithXp(70);
        h.api.saveSnapshot.mockRejectedValue(networkError());
        await logOut();
        expect(JSON.parse(h.store[PENDING_ALEX]).xp).toBe(70);
        expect(h.store.fighterXp).toBeUndefined();
        expect(h.account().status).toBe('guest');
    });

    it('still ends as a guest with local data cleared when the api logout fails', async () => {
        await loggedInWithXp(70);
        h.api.logOut.mockRejectedValue(networkError());
        await logOut();
        expect(h.warn).toHaveBeenCalled();
        expect(h.account()).toMatchObject({ status: 'guest', nickname: null });
        expect(h.store.fighterXp).toBeUndefined();
        expect(h.store.playerName).toBeUndefined();
    });
});

describe('AccountProvider pending progress on the next login', () => {
    const h = installAccountHarness();

    async function loggedOutWithPending(): Promise<void> {
        h.mount();
        await h.settle();
        await h.loginAs(ALEX);
        h.store.fighterXp = '70';
        h.api.saveSnapshot.mockRejectedValue(networkError());
        await act(async () => { await h.account().logOut(); });
        h.api.saveSnapshot.mockReset().mockResolvedValue(undefined);
        h.api.fetchSnapshot.mockResolvedValue(snap(10));
    }

    it('merges it back and pushes it when the same account logs in again', async () => {
        await loggedOutWithPending();
        await h.loginAs(ALEX);
        await h.settle();
        expect(h.store.fighterXp).toBe('70');
        expect(h.savedFor(ALEX.id).at(-1)?.xp).toBe(70);
        expect(h.store[PENDING_ALEX]).toBeUndefined();
    });

    it('keeps it marked unsent when the re-login cannot reach the cloud', async () => {
        await loggedOutWithPending();
        h.api.fetchSnapshot.mockRejectedValue(networkError());
        await h.loginAs(ALEX);
        await h.settle();
        expect(h.account().status).toBe('loggedIn');
        expect(h.store.fighterXp).toBe('70');
        expect(h.store[`accountDirty:${ALEX.id}`]).toBe('1');
    });

    it('never hands it to another account', async () => {
        await loggedOutWithPending();
        await h.loginAs(BO);
        await h.settle();
        expect(h.account().nickname).toBe('Bo');
        expect(h.store.fighterXp).toBe('10');
        expect(h.savedFor(ALEX.id)).toEqual([]);
        expect(JSON.parse(h.store[PENDING_ALEX]).xp).toBe(70);
    });
});
