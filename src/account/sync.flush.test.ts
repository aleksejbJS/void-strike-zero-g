import { describe, it, expect, vi } from 'vitest';
import { writeLocalSnapshot } from './localSnapshot';
import { installSyncHarness, look, networkError, snap, USER } from '../test/syncHarness';

describe('sync: flush', () => {
    const h = installSyncHarness();

    it('merges local with the cloud copy, saves it and clears the flag', async () => {
        writeLocalSnapshot(snap(50, { look }));
        h.fetchSnapshot.mockResolvedValue(snap(200));
        h.sync.requestPush(USER);

        await expect(h.sync.flush(USER)).resolves.toBe(true);

        expect(h.saved()).toEqual(snap(200, { look })); // never lowers the cloud xp, keeps the local look
        expect(h.sync.hasPending(USER)).toBe(false);
        expect(h.store['accountDirty:user-1']).toBeUndefined();
    });

    it('pushes the local snapshot when the cloud has none', async () => {
        writeLocalSnapshot(snap(50));
        await expect(h.sync.flush(USER)).resolves.toBe(true);
        expect(h.saved()).toEqual(snap(50));
    });

    it('keeps the flag, warns and returns false when the save fails; the next flush succeeds', async () => {
        h.saveSnapshot.mockRejectedValueOnce(networkError());
        h.sync.requestPush(USER);

        await expect(h.sync.flush(USER)).resolves.toBe(false);
        expect(h.sync.hasPending(USER)).toBe(true);
        expect(h.warn).toHaveBeenCalled();

        await expect(h.sync.flush(USER)).resolves.toBe(true);
        expect(h.sync.hasPending(USER)).toBe(false);
    });

    it('keeps the flag and returns false when the fetch fails, without saving', async () => {
        h.fetchSnapshot.mockRejectedValueOnce(networkError());
        await expect(h.sync.flush(USER)).resolves.toBe(false);
        expect(h.sync.hasPending(USER)).toBe(true);
        expect(h.saveSnapshot).not.toHaveBeenCalled();
    });

    it('retries on the next debounced push after a failure', async () => {
        h.saveSnapshot.mockRejectedValueOnce(networkError());
        h.sync.requestPush(USER);
        await vi.advanceTimersByTimeAsync(2000);
        expect(h.sync.hasPending(USER)).toBe(true);

        h.sync.requestPush(USER);
        await vi.advanceTimersByTimeAsync(2000);
        expect(h.saveSnapshot).toHaveBeenCalledTimes(2);
        expect(h.sync.hasPending(USER)).toBe(false);
    });

    it('never runs two flushes for one user at once, and still pushes the latest state', async () => {
        let active = 0;
        let maxActive = 0;
        let releaseFirst!: () => void;
        h.saveSnapshot.mockImplementation(async () => {
            active++;
            maxActive = Math.max(maxActive, active);
            if (h.saveSnapshot.mock.calls.length === 1) await new Promise<void>(r => { releaseFirst = r; });
            active--;
        });

        writeLocalSnapshot(snap(10));
        const first = h.sync.flush(USER);
        await vi.advanceTimersByTimeAsync(0);
        expect(h.saveSnapshot).toHaveBeenCalledTimes(1);

        writeLocalSnapshot(snap(20)); // changes while the first save is in flight
        const second = h.sync.flush(USER);
        const third = h.sync.flush(USER); // coalesced into the second
        await vi.advanceTimersByTimeAsync(0);
        expect(h.saveSnapshot).toHaveBeenCalledTimes(1);

        releaseFirst();
        await expect(Promise.all([first, second, third])).resolves.toEqual([true, true, true]);
        expect(h.saveSnapshot).toHaveBeenCalledTimes(2);
        expect(h.saved(1).xp).toBe(20);
        expect(maxActive).toBe(1);
    });

    it('a flush called right as the running one ends joins the queued follow-up instead of starting a second run', async () => {
        let active = 0;
        let maxActive = 0;
        h.saveSnapshot.mockImplementation(async () => {
            active++;
            maxActive = Math.max(maxActive, active);
            await new Promise<void>(r => setTimeout(r, 10));
            active--;
        });

        const first = h.sync.flush(USER);
        await vi.advanceTimersByTimeAsync(0);
        expect(h.saveSnapshot).toHaveBeenCalledTimes(1);

        // This continuation runs the moment the first flush settles, while the follow-up is still queued.
        const calledAgain = first.then(() => h.sync.flush(USER));
        const followUp = h.sync.flush(USER);

        await vi.advanceTimersByTimeAsync(100);
        await expect(Promise.all([first, calledAgain, followUp])).resolves.toEqual([true, true, true]);
        expect(h.saveSnapshot).toHaveBeenCalledTimes(2);
        expect(maxActive).toBe(1);
    });

    it('a manual flush cancels the pending debounce timer', async () => {
        h.sync.requestPush(USER);
        await expect(h.sync.flush(USER)).resolves.toBe(true);
        expect(h.saveSnapshot).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(5000);
        expect(h.saveSnapshot).toHaveBeenCalledTimes(1); // no redundant flush later
        expect(h.sync.hasPending(USER)).toBe(false);
    });

    it('does not clear the flag when another push arrived during the save', async () => {
        let releaseFirst!: () => void;
        h.saveSnapshot.mockImplementationOnce(() => new Promise<void>(r => { releaseFirst = r; }));

        h.sync.requestPush(USER);
        await vi.advanceTimersByTimeAsync(2000); // debounced flush starts, save hangs
        expect(h.saveSnapshot).toHaveBeenCalledTimes(1);

        h.sync.requestPush(USER); // new local change while saving
        releaseFirst();
        await vi.advanceTimersByTimeAsync(0);
        expect(h.sync.hasPending(USER)).toBe(true);

        await vi.advanceTimersByTimeAsync(2000);
        expect(h.saveSnapshot).toHaveBeenCalledTimes(2);
        expect(h.sync.hasPending(USER)).toBe(false);
    });
});
