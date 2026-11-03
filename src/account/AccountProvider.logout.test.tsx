import { describe, it, expect } from 'vitest';
import { act } from '@testing-library/react';
import { achievementManager } from '../game/systems/achievements';
import { ALEX, BO, deferred, installAccountHarness, networkError, snap } from '../test/accountHarness';
import { notifyProgressChanged } from './progressEvents';
import { DEFAULT_DEBOUNCE_MS } from './sync';

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

    it('keeps a change made during the last push as pending, even when that push succeeds', async () => {
        await loggedInWithXp(70);
        const save = deferred<void>();
        h.api.saveSnapshot.mockReturnValueOnce(save.promise);
        let pending!: Promise<void>;
        await act(async () => { pending = h.account().logOut(); });
        await h.settle();
        expect(h.api.saveSnapshot).toHaveBeenLastCalledWith(ALEX.id, expect.objectContaining({ xp: 70 }));
        h.store.fighterXp = '99'; // e.g. match XP paid while the push is on its way
        notifyProgressChanged();
        await act(async () => { save.resolve(); await pending; });
        expect(JSON.parse(h.store[PENDING_ALEX]).xp).toBe(99);
        expect(h.store.fighterXp).toBeUndefined();
        expect(h.account().status).toBe('guest');
    });

    it('is a guest before the logout request ends: what is earned meanwhile stays as guest progress', async () => {
        await loggedInWithXp(70);
        const request = deferred<void>();
        h.api.logOut.mockReturnValue(request.promise);
        let pending!: Promise<void>;
        await act(async () => { pending = h.account().logOut(); });
        await h.settle();
        expect(h.account()).toMatchObject({ status: 'guest', nickname: null });
        expect(h.store.fighterXp).toBeUndefined();
        const savesBefore = h.api.saveSnapshot.mock.calls.length;

        h.store.fighterXp = '15';
        achievementManager.updateProgress('first_blood');
        notifyProgressChanged();
        await act(async () => { request.resolve(); await pending; });
        await h.advance(DEFAULT_DEBOUNCE_MS);

        expect(h.store.fighterXp).toBe('15');
        expect(JSON.parse(h.store.achievementProgress).first_blood.unlocked).toBe(true);
        expect(h.api.saveSnapshot).toHaveBeenCalledTimes(savesBefore); // guest progress never goes to the account
        expect(h.store[PENDING_ALEX]).toBeUndefined();
    });

    it('a push queued behind a slow last push never sends the guest progress to the logged-out account', async () => {
        await loggedInWithXp(70);
        const save = deferred<void>();
        h.api.saveSnapshot.mockReturnValueOnce(save.promise);
        const request = deferred<void>();
        h.api.logOut.mockReturnValue(request.promise);
        let pending!: Promise<void>;
        await act(async () => { pending = h.account().logOut(); });
        await h.settle(); // the last push (xp 70) hangs
        const savesBefore = h.api.saveSnapshot.mock.calls.length;
        notifyProgressChanged(); // a change during the push...
        await h.advance(DEFAULT_DEBOUNCE_MS); // ...whose debounced flush queues behind it

        await act(async () => { save.resolve(); });
        await h.settle();
        expect(h.account().status).toBe('guest');
        h.store.fighterXp = '15'; // guest progress while the logout request runs
        await h.settle();
        await act(async () => { request.resolve(); await pending; });
        await h.advance(DEFAULT_DEBOUNCE_MS);

        expect(h.api.saveSnapshot).toHaveBeenCalledTimes(savesBefore);
        expect(h.savedFor(ALEX.id).map(s => s.xp)).not.toContain(15);
        expect(JSON.parse(h.store[PENDING_ALEX]).xp).toBe(70); // the change it missed is kept for this account
        expect(h.store.fighterXp).toBe('15');
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
