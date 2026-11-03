import { describe, it, expect, vi } from 'vitest';
import { installSyncHarness, USER } from '../test/syncHarness';

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
});
