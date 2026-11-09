import { describe, it, expect } from 'vitest';
import { CollectorMemory, collectDeltas, playTimeDelta } from './statsCollector';

const fresh = (): CollectorMemory => ({ session: null, seen: {} });

describe('collectDeltas', () => {
    it('credits a counter once when the same snapshot repeats', () => {
        const mem = fresh();
        expect(collectDeltas(mem, 'a', { kills: 2 })).toEqual({ kills: 2 });
        expect(collectDeltas(mem, 'a', { kills: 2 })).toEqual({});
    });

    it('credits only the increase', () => {
        const mem = fresh();
        collectDeltas(mem, 'a', { kills: 2 });
        expect(collectDeltas(mem, 'a', { kills: 5, botKills: 1 })).toEqual({ kills: 3, botKills: 1 });
    });

    it('never counts a rolled-back prediction twice', () => {
        const mem = fresh();
        expect(collectDeltas(mem, 'a', { hookUses: 3 })).toEqual({ hookUses: 3 });
        expect(collectDeltas(mem, 'a', { hookUses: 2 })).toEqual({});
        expect(collectDeltas(mem, 'a', { hookUses: 3 })).toEqual({});
    });

    it('starts again from zero in a new session', () => {
        const mem = fresh();
        expect(collectDeltas(mem, 'a', { kills: 5 })).toEqual({ kills: 5 });
        expect(collectDeltas(mem, 'b', { kills: 1 })).toEqual({ kills: 1 });
        expect(mem.session).toBe('b');
    });

    it('credits nothing without a session (an older server)', () => {
        const mem = fresh();
        expect(collectDeltas(mem, undefined, { kills: 4 })).toEqual({});
        // ...and a session that shows up later is counted from zero.
        expect(collectDeltas(mem, 'a', { kills: 4 })).toEqual({ kills: 4 });
    });

    it('credits nothing while the player has no counters yet', () => {
        const mem = fresh();
        expect(collectDeltas(mem, 'a', undefined)).toEqual({});
        expect(collectDeltas(mem, 'a', { kills: 1 })).toEqual({ kills: 1 });
    });

    it('ignores keys the simulation does not report', () => {
        const mem = fresh();
        expect(collectDeltas(mem, 'a', { kills: 1, playMs: 900, wins: 1 })).toEqual({ kills: 1 });
    });
});

describe('playTimeDelta', () => {
    it('counts the elapsed time while playing', () => {
        expect(playTimeDelta(250, true)).toBe(250);
    });

    it('caps a long gap (a throttled background tab) at one second', () => {
        expect(playTimeDelta(30000, true)).toBe(1000);
    });

    it('counts nothing while not playing', () => {
        expect(playTimeDelta(250, false)).toBe(0);
    });

    it('never goes negative when the clock steps back', () => {
        expect(playTimeDelta(-500, true)).toBe(0);
    });
});
