// Shared set-up for the sync tests: fake timers, a plain-object localStorage, a fake AccountApi
// (only the two snapshot calls sync uses) and a fresh Sync per test. Call inside a describe block.

import { afterEach, beforeEach, vi, Mock } from 'vitest';
import { DEFAULT_BUILD } from '../game/build/buildParts';
import { achievementManager } from '../game/systems/achievements';
import { AccountError } from '../account/accountError';
import type { AccountApi } from '../account/accountApi';
import { FighterLook, PlayerSnapshot } from '../account/snapshot';
import { createSync, Sync } from '../account/sync';

export const USER = 'user-1';
const colors = { player: '#3b82f6', head: '#111111', torso: '#3b82f6', arms: '#222222', legs: '#475569', jetpack: '#ef4444' };
export const look: FighterLook = { build: { ...DEFAULT_BUILD, helmet: 'dome' }, skinId: 'wolf', colors, savedAt: 77 };
export const snap = (xp: number, extra: Partial<PlayerSnapshot> = {}): PlayerSnapshot => ({ achievements: {}, xp, look: null, stats: {}, ...extra });
export const networkError = (): AccountError => new AccountError('network', 'offline');

export interface SyncHarness {
    readonly sync: Sync;
    readonly store: Record<string, string>;
    readonly warn: Mock;
    readonly fetchSnapshot: Mock<[string], Promise<PlayerSnapshot | null>>;
    readonly saveSnapshot: Mock<[string, PlayerSnapshot], Promise<void>>;
    /** The localStorage method mocks, to make storage fail or to count writes. */
    storageMocks(): Record<'getItem' | 'setItem' | 'removeItem', Mock>;
    /** The snapshot passed to the n-th saveSnapshot call. */
    saved(call?: number): PlayerSnapshot;
    /** Replaces the Sync under test, e.g. to change its options. */
    recreate(opts?: { debounceMs?: number }): void;
}

export function installSyncHarness(): SyncHarness {
    const h = {} as { -readonly [K in keyof SyncHarness]: SyncHarness[K] };
    const api = () => ({ fetchSnapshot: h.fetchSnapshot, saveSnapshot: h.saveSnapshot }) as unknown as AccountApi;

    h.storageMocks = () => localStorage as unknown as Record<'getItem' | 'setItem' | 'removeItem', Mock>;
    h.saved = (call = 0) => h.saveSnapshot.mock.calls[call][1];
    h.recreate = opts => {
        h.sync?.dispose();
        h.sync = createSync(api(), opts);
    };

    beforeEach(() => {
        vi.useFakeTimers();
        // The global test setup replaces localStorage methods with empty mocks: back them with a plain object.
        const store: Record<string, string> = {};
        const mocks = h.storageMocks();
        mocks.getItem.mockReset().mockImplementation((key: string) => (key in store ? store[key] : null));
        mocks.setItem.mockReset().mockImplementation((key: string, value: string) => { store[key] = value; });
        mocks.removeItem.mockReset().mockImplementation((key: string) => { delete store[key]; });
        h.store = store;
        achievementManager.reset();
        h.warn = vi.spyOn(console, 'warn').mockImplementation(() => {}) as unknown as Mock;
        h.fetchSnapshot = vi.fn().mockResolvedValue(null);
        h.saveSnapshot = vi.fn().mockResolvedValue(undefined);
        h.recreate();
    });

    afterEach(() => {
        h.sync.dispose();
        h.warn.mockRestore();
        vi.useRealTimers();
    });

    return h;
}
