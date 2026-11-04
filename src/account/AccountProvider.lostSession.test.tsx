// A session that dies without a logout here (expired, revoked, cleared by the browser) must not leave its
// account's progress to the guest or to the next account: it is kept for that account's next login.

import { describe, it, expect } from 'vitest';
import { act } from '@testing-library/react';
import { ALEX, BO, installAccountHarness, networkError, snap } from '../test/accountHarness';

const OWNER = 'accountOwner';
const PENDING_ALEX = `accountPending:${ALEX.id}`;

describe('AccountProvider start-up after a lost session', () => {
    const h = installAccountHarness();

    /** What a device looks like after Alex played here and the session then vanished. */
    const leftByAlex = (): void => {
        h.store[OWNER] = ALEX.id;
        h.store.fighterXp = '70';
        h.store.playerName = 'Alex';
    };

    it('a genuine guest (never logged in) keeps its progress untouched', async () => {
        h.store.fighterXp = '50';
        h.store.playerName = 'Zed';
        h.mount();
        await h.settle();
        expect(h.account().status).toBe('guest');
        expect(h.store).toMatchObject({ fighterXp: '50', playerName: 'Zed' });
        expect(Object.keys(h.store).some(key => key.startsWith('accountPending:'))).toBe(false);
    });

    it('no session any more: the progress is kept for that account and the device is a clean guest', async () => {
        leftByAlex();
        h.mount();
        await h.settle();
        expect(h.account()).toMatchObject({ status: 'guest', nickname: null });
        expect(JSON.parse(h.store[PENDING_ALEX]).xp).toBe(70);
        expect(h.store.fighterXp).toBeUndefined();
        expect(h.store.playerName).toBeUndefined();
        expect(h.store[OWNER]).toBeUndefined();
        expect(h.ui().playerName).toBe('Anonymous');
    });

    it('a session that cannot be used at all is treated the same way', async () => {
        leftByAlex();
        h.api.currentUser.mockRejectedValue(networkError());
        h.mount();
        await h.settle();
        expect(h.account().status).toBe('guest');
        expect(JSON.parse(h.store[PENDING_ALEX]).xp).toBe(70);
        expect(h.store.fighterXp).toBeUndefined();
    });

    it('merges with progress the account already had waiting here, never lowering it', async () => {
        leftByAlex();
        h.store[PENDING_ALEX] = JSON.stringify(snap(90));
        h.mount();
        await h.settle();
        expect(JSON.parse(h.store[PENDING_ALEX]).xp).toBe(90);
    });

    it('the next account starts clean; the kept progress returns only to its own account', async () => {
        leftByAlex();
        h.mount();
        await h.settle();
        await h.loginAs(BO);
        await h.settle();
        expect(Number(h.store.fighterXp ?? 0)).toBe(0);
        expect(h.savedFor(BO.id).map(s => s.xp)).not.toContain(70);
        expect(h.store[OWNER]).toBe(BO.id);

        await h.endSession(); // Bo's session ends too; then Alex comes back
        await h.loginAs(ALEX);
        await h.settle();
        expect(h.store.fighterXp).toBe('70');
        expect(h.savedFor(ALEX.id).at(-1)?.xp).toBe(70);
        expect(h.store[PENDING_ALEX]).toBeUndefined();
    });

    it('a restored session of another account sets the old owner\'s progress aside first', async () => {
        leftByAlex();
        h.api.currentUser.mockResolvedValue(BO);
        h.mount();
        await h.settle();
        expect(h.account().nickname).toBe('Bo');
        expect(JSON.parse(h.store[PENDING_ALEX]).xp).toBe(70);
        expect(Number(h.store.fighterXp ?? 0)).toBe(0);
        expect(h.store[OWNER]).toBe(BO.id);
    });

    it('the same account restored (also offline, from the device) keeps its progress in place', async () => {
        leftByAlex();
        h.api.currentUser.mockResolvedValue(ALEX);
        h.api.fetchSnapshot.mockRejectedValue(networkError());
        h.mount();
        await h.settle();
        expect(h.account().status).toBe('loggedIn');
        expect(h.store.fighterXp).toBe('70');
        expect(h.store[PENDING_ALEX]).toBeUndefined();
    });
});

describe('AccountProvider when the session ends while logged in', () => {
    const h = installAccountHarness();

    async function loggedInWithXp(xp: number): Promise<void> {
        h.mount();
        await h.settle();
        await h.loginAs(ALEX);
        h.store.fighterXp = String(xp);
    }

    it('marks the device as the account\'s at login and forgets that at logout', async () => {
        await loggedInWithXp(10);
        expect(h.store[OWNER]).toBe(ALEX.id);
        await act(async () => { await h.account().logOut(); });
        expect(h.store[OWNER]).toBeUndefined();
    });

    it('becomes a clean guest without asking the server to log out again', async () => {
        await loggedInWithXp(70);
        await h.endSession();
        expect(h.account()).toMatchObject({ status: 'guest', nickname: null });
        expect(h.api.logOut).not.toHaveBeenCalled();
        expect(h.savedFor(ALEX.id).at(-1)?.xp).toBe(70); // the last push was still tried
        expect(h.store.fighterXp).toBeUndefined();
        expect(h.store[OWNER]).toBeUndefined();
        expect(h.store[PENDING_ALEX]).toBeUndefined();
    });

    it('keeps what could not be sent for that account', async () => {
        await loggedInWithXp(70);
        h.api.saveSnapshot.mockRejectedValue(networkError());
        await h.endSession();
        expect(h.account().status).toBe('guest');
        expect(JSON.parse(h.store[PENDING_ALEX]).xp).toBe(70);
        expect(h.store.fighterXp).toBeUndefined();
    });

    it('ignores the end of a session while a guest', async () => {
        h.store.fighterXp = '5';
        h.mount();
        await h.settle();
        await h.endSession();
        expect(h.account().status).toBe('guest');
        expect(h.store.fighterXp).toBe('5');
        expect(h.api.saveSnapshot).not.toHaveBeenCalled();
    });

    it('listens only while mounted', async () => {
        const view = h.mount();
        await h.settle();
        expect(h.sessionListeners()).toBe(1); // StrictMode's first subscription was dropped
        view.unmount();
        expect(h.sessionListeners()).toBe(0);
    });
});
