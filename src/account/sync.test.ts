import { describe, it, expect, vi } from 'vitest';
import { installSyncHarness, snap, USER } from '../test/syncHarness';
import type { PlayerSnapshot } from './snapshot';

describe('sync: requestPush and dispose', () => {
    const h = installSyncHarness();

    it('marks the account dirty right away, without saving yet', () => {
        h.sync.requestPush(USER);
        expect(h.store['accountDirty:user-1']).toBe('1');
        expect(h.sync.hasPending(USER)).toBe(true);
        expect(h.saveSnapshot).not.toHaveBeenCalled();
    });

    it('debounces three pushes within 2 s into one save', async () => {
        h.sync.requestPush(USER);
        await vi.advanceTimersByTimeAsync(500);
        h.sync.requestPush(USER);
        await vi.advanceTimersByTimeAsync(500);
        h.sync.requestPush(USER);
        await vi.advanceTimersByTimeAsync(1999);
        expect(h.saveSnapshot).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(h.saveSnapshot).toHaveBeenCalledTimes(1);
        expect(h.saveSnapshot).toHaveBeenCalledWith(USER, expect.any(Object));
        expect(h.sync.hasPending(USER)).toBe(false);
    });

    it('honours a custom debounce', async () => {
        h.recreate({ debounceMs: 100 });
        h.sync.requestPush(USER);
        await vi.advanceTimersByTimeAsync(100);
        expect(h.saveSnapshot).toHaveBeenCalledTimes(1);
    });

    it('keeps users apart', () => {
        h.sync.requestPush('a');
        expect(h.sync.hasPending('a')).toBe(true);
        expect(h.sync.hasPending('b')).toBe(false);
    });

    it('warns instead of throwing when storage refuses the dirty flag', () => {
        h.storageMocks().setItem.mockImplementation(() => { throw new Error('quota'); });
        expect(() => h.sync.requestPush(USER)).not.toThrow();
        expect(h.warn).toHaveBeenCalled();
    });

    it('dispose cancels the pending timer but leaves the account marked for the next session', async () => {
        h.sync.requestPush(USER);
        h.sync.dispose();
        await vi.advanceTimersByTimeAsync(5000);
        expect(h.saveSnapshot).not.toHaveBeenCalled();
        expect(h.sync.hasPending(USER)).toBe(true);
    });

    it('a push requested after dispose is remembered but never scheduled', async () => {
        h.sync.dispose();
        h.sync.requestPush(USER);
        await vi.advanceTimersByTimeAsync(5000);
        expect(h.saveSnapshot).not.toHaveBeenCalled();
        expect(h.sync.hasPending(USER)).toBe(true);
    });

    it('a flush already in flight does not clear the flag of a push requested after dispose', async () => {
        let release!: () => void;
        h.saveSnapshot.mockImplementationOnce(() => new Promise<void>(r => { release = r; }));
        h.sync.requestPush(USER);
        await vi.advanceTimersByTimeAsync(2000); // debounced flush starts, save hangs

        h.sync.dispose();
        h.sync.requestPush(USER); // a local change the running flush may have missed
        release();
        await vi.advanceTimersByTimeAsync(0);

        expect(h.sync.hasPending(USER)).toBe(true); // survives for the next session
    });

    it('a follow-up flush queued behind the running one never starts after dispose', async () => {
        let release!: () => void;
        h.saveSnapshot.mockImplementationOnce(() => new Promise<void>(r => { release = r; }));
        // Like logout: its last flush is awaited first, and the session is disposed as soon as it settles.
        const disposedAfter = h.sync.flush(USER).then(result => { h.sync.dispose(); return result; });
        await vi.advanceTimersByTimeAsync(0); // the save hangs
        h.sync.requestPush(USER); // a change during the save...
        await vi.advanceTimersByTimeAsync(2000); // ...whose debounced flush queues a follow-up behind it
        const followUp = h.sync.flush(USER); // joins that queued follow-up
        release();
        await expect(disposedAfter).resolves.toBe(true);
        await expect(followUp).resolves.toBe(false);
        await vi.advanceTimersByTimeAsync(5000);

        expect(h.saveSnapshot).toHaveBeenCalledTimes(1); // local may already belong to someone else
        expect(h.sync.hasPending(USER)).toBe(true); // the missed change stays marked
    });

    it('a flush whose fetch is still pending at dispose never reads local nor saves', async () => {
        let answer!: (remote: null) => void;
        h.fetchSnapshot.mockImplementationOnce(() => new Promise<null>(r => { answer = r; }));
        h.sync.requestPush(USER);
        const flushing = h.sync.flush(USER);
        await vi.advanceTimersByTimeAsync(0); // the fetch hangs
        h.sync.dispose(); // logout: local is cleared next and may then hold guest progress
        answer(null);

        await expect(flushing).resolves.toBe(false);
        expect(h.saveSnapshot).not.toHaveBeenCalled();
        expect(h.sync.hasPending(USER)).toBe(true); // left as it was, for the next session
        expect(h.warn).not.toHaveBeenCalled(); // not a failure, just too late
    });

    it('a pull whose fetch is still pending at dispose leaves local storage alone', async () => {
        let answer!: (remote: PlayerSnapshot) => void;
        h.fetchSnapshot.mockImplementationOnce(() => new Promise<PlayerSnapshot>(r => { answer = r; }));
        const pulling = h.sync.pull(USER);
        await vi.advanceTimersByTimeAsync(0);
        h.sync.dispose();
        answer(snap(300));

        await expect(pulling).resolves.toBeUndefined();
        expect(h.store.fighterXp).toBeUndefined();
        expect(h.saveSnapshot).not.toHaveBeenCalled();
    });

    it('flush and pull on a disposed sync do nothing and call no api', async () => {
        h.sync.requestPush(USER);
        h.sync.dispose();
        await expect(h.sync.flush(USER)).resolves.toBe(false);
        await expect(h.sync.pull(USER)).resolves.toBeUndefined();
        expect(h.fetchSnapshot).not.toHaveBeenCalled();
        expect(h.saveSnapshot).not.toHaveBeenCalled();
        expect(h.sync.hasPending(USER)).toBe(true);
    });
});
