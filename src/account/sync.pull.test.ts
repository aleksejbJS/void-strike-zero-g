import { describe, it, expect } from 'vitest';
import { AccountError } from './accountError';
import { readLocalSnapshot, writeLocalSnapshot } from './localSnapshot';
import { installSyncHarness, look, networkError, snap, USER } from '../test/syncHarness';

describe('sync: pull', () => {
    const h = installSyncHarness();

    it('writes the higher cloud xp locally and saves nothing when the cloud already has everything', async () => {
        writeLocalSnapshot(snap(50));
        h.fetchSnapshot.mockResolvedValue(snap(200));

        await h.sync.pull(USER);

        expect(readLocalSnapshot().xp).toBe(200);
        expect(h.saveSnapshot).not.toHaveBeenCalled();
        expect(h.sync.hasPending(USER)).toBe(false);
    });

    it('pushes the local snapshot when the cloud has none', async () => {
        writeLocalSnapshot(snap(50, { look }));
        h.fetchSnapshot.mockResolvedValue(null);

        await h.sync.pull(USER);

        expect(h.saveSnapshot).toHaveBeenCalledTimes(1);
        expect(h.saved()).toEqual(snap(50, { look }));
        expect(h.sync.hasPending(USER)).toBe(false);
    });

    it('pushes the merge when local is ahead of the cloud', async () => {
        writeLocalSnapshot(snap(300, { look }));
        h.fetchSnapshot.mockResolvedValue(snap(200));

        await h.sync.pull(USER);

        expect(h.saved().xp).toBe(300);
        expect(readLocalSnapshot().xp).toBe(300);
    });

    it('takes achievements from both sides and pushes the union', async () => {
        writeLocalSnapshot(snap(0, { achievements: { killer: { progress: 10, unlocked: true, unlockedAt: 5 } } }));
        h.fetchSnapshot.mockResolvedValue(snap(0, { achievements: { first_blood: { progress: 1, unlocked: false } } }));

        await h.sync.pull(USER);

        const expected = {
            killer: { progress: 10, unlocked: true, unlockedAt: 5 },
            first_blood: { progress: 1, unlocked: false },
        };
        expect(readLocalSnapshot().achievements).toEqual(expected);
        expect(h.saved().achievements).toEqual(expected);
    });

    it('does not save when the cloud copy only differs in key order', async () => {
        const killer = { progress: 10, unlocked: true, unlockedAt: 5 };
        const firstBlood = { progress: 1, unlocked: false };
        writeLocalSnapshot(snap(5, { achievements: { killer, first_blood: firstBlood } }));
        h.fetchSnapshot.mockResolvedValue(snap(5, { achievements: { first_blood: firstBlood, killer } }));

        await h.sync.pull(USER);

        expect(h.saveSnapshot).not.toHaveBeenCalled();
    });

    it('leaves local storage untouched and rejects when the fetch fails', async () => {
        writeLocalSnapshot(snap(50));
        const writesBefore = h.storageMocks().setItem.mock.calls.length;
        h.fetchSnapshot.mockRejectedValue(networkError());

        await expect(h.sync.pull(USER)).rejects.toBeInstanceOf(AccountError);

        expect(h.storageMocks().setItem.mock.calls.length).toBe(writesBefore);
        expect(readLocalSnapshot().xp).toBe(50);
        expect(h.saveSnapshot).not.toHaveBeenCalled();
    });

    it('keeps the merged local copy and stays pending when the follow-up push fails', async () => {
        writeLocalSnapshot(snap(300));
        h.fetchSnapshot.mockResolvedValue(snap(200));
        h.saveSnapshot.mockRejectedValue(networkError());

        await expect(h.sync.pull(USER)).resolves.toBeUndefined(); // the failed push is retried later, not thrown

        expect(readLocalSnapshot().xp).toBe(300);
        expect(h.sync.hasPending(USER)).toBe(true);
    });
});
