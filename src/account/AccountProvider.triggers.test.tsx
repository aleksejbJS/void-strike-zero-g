import { describe, it, expect } from 'vitest';
import { act } from '@testing-library/react';
import { achievementManager } from '../game/systems/achievements';
import { ALEX, installAccountHarness, networkError } from '../test/accountHarness';
import { notifyProgressChanged } from './progressEvents';
import { DEFAULT_DEBOUNCE_MS } from './sync';

const DIRTY_ALEX = `accountDirty:${ALEX.id}`;

describe('AccountProvider push triggers', () => {
    const h = installAccountHarness();

    async function loggedIn(): Promise<void> {
        h.mount();
        await h.settle();
        await h.loginAs(ALEX);
        await h.settle();
        h.api.saveSnapshot.mockClear(); // the login itself uploads the guest progress
    }

    it('turns a burst of achievement unlocks into one push after the debounce', async () => {
        await loggedIn();
        achievementManager.updateProgress('first_blood');
        achievementManager.updateProgress('acrobatic', 1e9);
        await h.advance(DEFAULT_DEBOUNCE_MS - 1);
        expect(h.api.saveSnapshot).not.toHaveBeenCalled();
        await h.advance(1);
        expect(h.api.saveSnapshot).toHaveBeenCalledTimes(1);
        expect(h.savedFor(ALEX.id)[0].achievements.first_blood?.unlocked).toBe(true);
    });

    it('pushes after notifyProgressChanged (match XP, saved build)', async () => {
        await loggedIn();
        h.store.fighterXp = '90';
        notifyProgressChanged();
        await h.advance(DEFAULT_DEBOUNCE_MS);
        expect(h.savedFor(ALEX.id).map(s => s.xp)).toEqual([90]);
    });

    it('never pushes for a guest, nor after logout', async () => {
        h.mount();
        await h.settle();
        notifyProgressChanged();
        await h.advance(DEFAULT_DEBOUNCE_MS);
        await h.loginAs(ALEX);
        await act(async () => { await h.account().logOut(); });
        h.api.saveSnapshot.mockClear();
        achievementManager.updateProgress('first_blood');
        notifyProgressChanged();
        window.dispatchEvent(new Event('online'));
        await h.advance(DEFAULT_DEBOUNCE_MS * 2);
        expect(h.api.saveSnapshot).not.toHaveBeenCalled();
    });

    it('stops listening when unmounted', async () => {
        const view = h.mount();
        await h.settle();
        await h.loginAs(ALEX);
        await h.settle();
        h.api.saveSnapshot.mockClear();
        view.unmount();
        achievementManager.updateProgress('first_blood');
        notifyProgressChanged();
        window.dispatchEvent(new Event('online'));
        await h.advance(DEFAULT_DEBOUNCE_MS * 2);
        expect(h.api.saveSnapshot).not.toHaveBeenCalled();
    });

    it('stays logged in when the pull fails and retries the push', async () => {
        h.api.fetchSnapshot.mockRejectedValueOnce(networkError());
        h.store.fighterXp = '40';
        h.mount();
        await h.settle();
        await h.loginAs(ALEX);
        await h.settle();
        expect(h.account()).toMatchObject({ status: 'loggedIn', nickname: 'Alex' });
        expect(h.warn).toHaveBeenCalled();
        expect(h.savedFor(ALEX.id).map(s => s.xp)).toEqual([40]);
        expect(h.store[DIRTY_ALEX]).toBeUndefined();
    });

    it('keeps the progress marked unsent while the cloud stays unreachable', async () => {
        h.api.fetchSnapshot.mockRejectedValue(networkError());
        h.mount();
        await h.settle();
        await h.loginAs(ALEX);
        await h.settle();
        expect(h.account().status).toBe('loggedIn');
        expect(h.store[DIRTY_ALEX]).toBe('1');
    });

    it('flushes unsent progress when the browser comes back online', async () => {
        await loggedIn();
        h.api.saveSnapshot.mockRejectedValue(networkError());
        notifyProgressChanged();
        await h.advance(DEFAULT_DEBOUNCE_MS);
        expect(h.store[DIRTY_ALEX]).toBe('1');
        h.api.saveSnapshot.mockReset().mockResolvedValue(undefined);
        window.dispatchEvent(new Event('online'));
        await h.settle();
        expect(h.api.saveSnapshot).toHaveBeenCalledTimes(1);
        expect(h.store[DIRTY_ALEX]).toBeUndefined();
    });

    it('does nothing on online when nothing is pending', async () => {
        await loggedIn();
        window.dispatchEvent(new Event('online'));
        await h.settle();
        expect(h.api.saveSnapshot).not.toHaveBeenCalled();
    });
});
