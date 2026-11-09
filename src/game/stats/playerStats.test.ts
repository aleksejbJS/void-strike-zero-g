import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameMode } from '../../types';
import { createMockState } from '../../test/mocks';
import { bumpStat, newStatsSession } from './playerStats';

afterEach(() => { vi.unstubAllGlobals(); });

describe('bumpStat', () => {
    it('creates the table and the entry on first use, then adds', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        bumpStat(state, 'me', 'hookUses');
        bumpStat(state, 'me', 'hookUses', 2);
        bumpStat(state, 'you', 'kills');
        expect(state.playerStats).toEqual({ me: { hookUses: 3 }, you: { kills: 1 } });
    });
});

describe('newStatsSession', () => {
    it('gives a different non-empty id each time', () => {
        const a = newStatsSession();
        const b = newStatsSession();
        expect(a.length).toBeGreaterThan(0);
        expect(a).not.toBe(b);
    });

    it('still works without crypto.randomUUID', () => {
        vi.stubGlobal('crypto', undefined);
        const a = newStatsSession();
        const b = newStatsSession();
        expect(a.length).toBeGreaterThan(0);
        expect(a).not.toBe(b);
    });
});
