import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { savePending, takePending } from './pendingStore';
import { PlayerSnapshot } from './snapshot';

const snapshot: PlayerSnapshot = {
    achievements: { killer: { progress: 10, unlocked: true, unlockedAt: 5 } },
    xp: 120,
    look: null,
    stats: { kills: 9, futureStat: 2 } as PlayerSnapshot['stats'],
};

describe('pendingStore', () => {
    let store: Record<string, string>;
    let warn: Mock;
    const mocks = () => localStorage as unknown as Record<'getItem' | 'setItem' | 'removeItem', Mock>;

    beforeEach(() => {
        // The global test setup replaces localStorage methods with empty mocks: back them with a plain object.
        store = {};
        mocks().getItem.mockReset().mockImplementation((key: string) => (key in store ? store[key] : null));
        mocks().setItem.mockReset().mockImplementation((key: string, value: string) => { store[key] = value; });
        mocks().removeItem.mockReset().mockImplementation((key: string) => { delete store[key]; });
        warn = vi.spyOn(console, 'warn').mockImplementation(() => {}) as unknown as Mock;
    });
    afterEach(() => warn.mockRestore());

    it('returns null when nothing was saved', () => {
        expect(takePending('u1')).toBeNull();
        expect(warn).not.toHaveBeenCalled();
    });

    it('hands the snapshot only to the account it was saved for', () => {
        savePending('u1', snapshot);
        expect(takePending('u2')).toBeNull();
        expect(store['accountPending:u1']).toBeDefined(); // u2 did not consume it
        expect(takePending('u1')).toEqual(snapshot);
    });

    it('removes the snapshot once taken', () => {
        savePending('u1', snapshot);
        expect(takePending('u1')).toEqual(snapshot);
        expect(store['accountPending:u1']).toBeUndefined();
        expect(takePending('u1')).toBeNull();
        expect(warn).not.toHaveBeenCalled();
    });

    it('keeps one pending snapshot per account', () => {
        savePending('u1', snapshot);
        savePending('u2', { ...snapshot, xp: 7 });
        expect(takePending('u2')?.xp).toBe(7);
        expect(takePending('u1')?.xp).toBe(120);
    });

    it('overwrites an older pending snapshot of the same account', () => {
        savePending('u1', snapshot);
        savePending('u1', { ...snapshot, xp: 999 });
        expect(takePending('u1')?.xp).toBe(999);
    });

    it('sanitizes what it hands back', () => {
        store['accountPending:u1'] = JSON.stringify({ xp: -5, achievements: 'nope', extra: true });
        expect(takePending('u1')).toEqual({ achievements: {}, xp: 0, look: null, stats: {} });
    });

    it('drops corrupt JSON with a warning naming the key', () => {
        store['accountPending:u1'] = '{not json';
        expect(takePending('u1')).toBeNull();
        expect(store['accountPending:u1']).toBeUndefined();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('accountPending:u1'), expect.anything());
    });

    it('warns instead of throwing when storage refuses the write', () => {
        mocks().setItem.mockImplementation(() => { throw new Error('quota'); });
        expect(() => savePending('u1', snapshot)).not.toThrow();
        expect(warn).toHaveBeenCalled();
    });
});
