import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { damageCover } from '../cover/coverDamage';
import { gameEvents } from '../systems/events';
import type { GameEvent } from '../systems/events';
import { LOCAL_ID } from './rangeTestKit';
import { T, hitDummy, readoutSession } from './rangeReadoutTestKit';
import { reviveDummy } from './rangeReset';
import { rebaseReadout, recentDamage, trackRangeDamage } from './rangeReadout';

let events: GameEvent[] = [];
let unsubscribe: () => void;
beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); // applyDamage reads Date.now() itself
    vi.setSystemTime(T);
    events = [];
    unsubscribe = gameEvents.on(e => events.push(e));
});
afterEach(() => { unsubscribe(); vi.useRealTimers(); });

const floatTexts = () => events.filter(e => e.type === 'FLOAT_TEXT');

describe('rebaseReadout: what the range itself changes is not damage', () => {
    it('armour switched off (K) logs nothing: dummies at 100 armour, set to 0 as tickRange does', () => {
        const s = readoutSession();
        s.dummies.forEach(d => { d.armor = 100; });
        trackRangeDamage(s.memory, s.state, T + 10); // K on: a rise
        s.dummies.forEach(d => { d.armor = 0; });
        rebaseReadout(s.memory, s.state);
        trackRangeDamage(s.memory, s.state, T + 20);
        s.dummies.forEach(d => expect(recentDamage(s.memory, d.id, T + 20)).toBe(0));
        expect(s.memory.hits).toEqual({});
    });

    it('without the rebase the same armour change would be read as damage', () => {
        const s = readoutSession();
        s.dummy.armor = 100;
        trackRangeDamage(s.memory, s.state, T + 10);
        s.dummy.armor = 0;
        trackRangeDamage(s.memory, s.state, T + 20);
        expect(recentDamage(s.memory, s.dummy.id, T + 20)).toBe(100);
    });

    it('a real hit after the rebase is still logged with its exact amount', () => {
        const s = readoutSession();
        s.dummy.armor = 100;
        trackRangeDamage(s.memory, s.state, T + 10);
        s.dummy.armor = 0;
        rebaseReadout(s.memory, s.state);
        hitDummy(s, 35, T + 20);
        expect(recentDamage(s.memory, s.dummy.id, T + 20)).toBe(35);
    });

    it('keeps the hits already logged', () => {
        const s = readoutSession();
        hitDummy(s, 20, T + 10);
        rebaseReadout(s.memory, s.state);
        expect(recentDamage(s.memory, s.dummy.id, T + 20)).toBe(20);
    });

    it('a revived dummy and a mended piece log nothing, and a number is not emitted for the piece', () => {
        const s = readoutSession();
        const piece = s.state.cover![0];
        const full = piece.hp;
        hitDummy(s, 9999, T + 10);
        damageCover(s.state, piece, full, LOCAL_ID, T + 10);
        trackRangeDamage(s.memory, s.state, T + 10);
        const dummyLogged = recentDamage(s.memory, s.dummy.id, T + 10);
        const pieceLogged = recentDamage(s.memory, piece.id, T + 10);

        reviveDummy(s.state, s.dummy, T + 20);
        piece.hp = full;
        events.length = 0;
        rebaseReadout(s.memory, s.state);
        trackRangeDamage(s.memory, s.state, T + 30);
        expect(recentDamage(s.memory, s.dummy.id, T + 30)).toBe(dummyLogged);
        expect(recentDamage(s.memory, piece.id, T + 30)).toBe(pieceLogged);
        expect(floatTexts()).toEqual([]);
    });

    it('stores the current value of every dummy and piece and forgets ids that are gone', () => {
        const s = readoutSession();
        s.memory.last.ghost = 42;
        s.dummy.health = 70;
        s.dummy.armor = 5;
        rebaseReadout(s.memory, s.state);
        expect(s.memory.last.ghost).toBeUndefined();
        expect(s.memory.last[s.dummy.id]).toBe(75);
        expect(s.memory.last[s.state.cover![0].id]).toBe(s.state.cover![0].hp);
        expect(s.memory.last[s.local.id]).toBeUndefined();
        expect(Object.keys(s.memory.last)).toHaveLength(s.dummies.length + s.state.cover!.length);
    });
});
