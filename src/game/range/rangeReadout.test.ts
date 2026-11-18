import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WeaponType } from '../../types';
import type { Entity } from '../../types';
import { applyDamage } from '../systems/combat';
import { damageCover } from '../cover/coverDamage';
import { COVER_SPECS } from '../cover/coverTypes';
import { gameEvents } from '../systems/events';
import type { GameEvent } from '../systems/events';
import { LOCAL_ID, physicsTick, rangeFixture } from './rangeTestKit';
import type { RangeFixture } from './rangeTestKit';
import { reviveDummy } from './rangeReset';
import { createReadoutMemory, recentDamage, trackRangeDamage } from './rangeReadout';
import type { ReadoutMemory } from './rangeReadout';

const T = 1_000_000;
const NO_PUSH = { x: 0, y: 0 };

let events: GameEvent[] = [];
let unsubscribe: () => void;
beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); // applyDamage and updatePhysics read Date.now() themselves
    vi.setSystemTime(T);
    events = [];
    unsubscribe = gameEvents.on(e => events.push(e));
});
afterEach(() => { unsubscribe(); vi.useRealTimers(); });

const floatTexts = () => events.filter(e => e.type === 'FLOAT_TEXT');

/** A started range with a memory that has already seen it whole (the baseline of a fresh session). */
const session = (): RangeFixture & { memory: ReadoutMemory; dummy: Entity } => {
    const fx = rangeFixture();
    const memory = createReadoutMemory();
    trackRangeDamage(memory, fx.state, T);
    return { ...fx, memory, dummy: fx.dummies[0] };
};

/** A hit on `dummy` at `at`, then the tracker's step. */
const hit = (s: ReturnType<typeof session>, amount: number, at: number, source = {}) => {
    vi.setSystemTime(at);
    applyDamage(s.state, s.dummy, LOCAL_ID, amount, NO_PUSH, 0, source);
    trackRangeDamage(s.memory, s.state, at);
};

describe('trackRangeDamage: dummies', () => {
    it('adds up two hits one second apart', () => {
        const s = session();
        hit(s, 20, T);
        hit(s, 30, T + 1000);
        expect(recentDamage(s.memory, s.dummy.id, T + 1000)).toBe(50);
    });

    it('forgets a hit after 3 s: at +3.5 s only the second is left, at +4.5 s none', () => {
        const s = session();
        hit(s, 20, T);
        hit(s, 30, T + 1000);
        expect(recentDamage(s.memory, s.dummy.id, T + 3500)).toBe(30);
        expect(recentDamage(s.memory, s.dummy.id, T + 4500)).toBe(0);
    });

    it('keeps a hit exactly 3000 ms old and drops it one ms later', () => {
        const s = session();
        hit(s, 25, T);
        expect(recentDamage(s.memory, s.dummy.id, T + 3000)).toBe(25);
        expect(recentDamage(s.memory, s.dummy.id, T + 3001)).toBe(0);
    });

    it('drops old entries from the memory on the next step', () => {
        const s = session();
        hit(s, 25, T);
        trackRangeDamage(s.memory, s.state, T + 3500);
        expect(s.memory.hits[s.dummy.id] ?? []).toEqual([]);
    });

    it('counts armour: a hit the armour soaks is damage too', () => {
        const s = session();
        s.dummy.armor = 100;
        trackRangeDamage(s.memory, s.state, T); // the K toggle gave the armour: a rise, not a hit
        hit(s, 40, T + 100);
        expect(s.dummy.health).toBeGreaterThan(80); // the armour took most of it
        expect(recentDamage(s.memory, s.dummy.id, T + 100)).toBe(40);
    });

    it('counts burning, which the game shows no number for', () => {
        const s = session();
        hit(s, 5, T, { burn: true });
        hit(s, 5, T + 500, { burn: true });
        expect(s.dummy.health).toBe(90);
        expect(recentDamage(s.memory, s.dummy.id, T + 500)).toBe(10);
        expect(floatTexts()).toEqual([]); // nothing from the range for a fighter either
    });

    it('counts an armoured railgun wound and the bleeding that follows', () => {
        const s = session();
        s.dummy.armor = 100;
        trackRangeDamage(s.memory, s.state, T);
        hit(s, 80, T + 10, { weapon: WeaponType.RAILGUN });
        expect(s.dummy.wound).toBeDefined();
        expect(s.dummy.armor).toBe(0);
        expect(s.dummy.health).toBe(10);
        expect(recentDamage(s.memory, s.dummy.id, T + 10)).toBe(190); // 100 armour + 90 health

        // One second of bleeding, one physics tick (120 Hz) at a time, as the range loop runs it
        for (let i = 1; i <= 120; i++) {
            const at = T + 10 + Math.round((i * 1000) / 120);
            vi.setSystemTime(at);
            physicsTick(s.state);
            trackRangeDamage(s.memory, s.state, at);
        }
        expect(s.dummy.health).toBeCloseTo(9, 3);
        expect(recentDamage(s.memory, s.dummy.id, T + 1010)).toBe(191);
    });

    it('logs the whole hit of a kill, then a revive is a rise: no negative damage', () => {
        const s = session();
        hit(s, 9999, T + 100);
        expect(s.dummy.dead).toBe(true);
        expect(recentDamage(s.memory, s.dummy.id, T + 100)).toBe(9999);

        vi.setSystemTime(T + 3000);
        reviveDummy(s.state, s.dummy, T + 3000);
        trackRangeDamage(s.memory, s.state, T + 3000);
        expect(s.memory.last[s.dummy.id]).toBe(100);
        expect(recentDamage(s.memory, s.dummy.id, T + 3000)).toBe(9999); // the kill, with nothing taken off for the revive
        trackRangeDamage(s.memory, s.state, T + 3016);
        expect(recentDamage(s.memory, s.dummy.id, T + 3016)).toBe(9999);
    });

    it('keeps a separate log for each dummy', () => {
        const s = session();
        hit(s, 20, T);
        expect(recentDamage(s.memory, s.dummies[1].id, T)).toBe(0);
        expect(recentDamage(s.memory, 'nobody', T)).toBe(0);
    });

    it('ignores the local fighter', () => {
        const s = session();
        s.local.health = 10;
        trackRangeDamage(s.memory, s.state, T + 10);
        expect(recentDamage(s.memory, s.local.id, T + 10)).toBe(0);
    });
});

describe('trackRangeDamage: cover', () => {
    const hitCover = (s: ReturnType<typeof session>, index: number, amount: number, at: number) => {
        vi.setSystemTime(at);
        damageCover(s.state, s.state.cover![index], amount, LOCAL_ID, at);
        trackRangeDamage(s.memory, s.state, at);
    };

    it('shows one yellow number with the drop, just above the top of the piece', () => {
        const s = session();
        const piece = s.state.cover![0];
        events.length = 0;
        hitCover(s, 0, 35, T + 50);
        expect(floatTexts()).toEqual([{
            type: 'FLOAT_TEXT', x: piece.pos.x, y: piece.pos.y - COVER_SPECS[piece.kind].h - 10, text: '35', color: '#facc15',
        }]);
        expect(recentDamage(s.memory, piece.id, T + 50)).toBe(35);
    });

    it('says nothing when the piece is not hit', () => {
        const s = session();
        events.length = 0;
        trackRangeDamage(s.memory, s.state, T + 16);
        trackRangeDamage(s.memory, s.state, T + 32);
        expect(floatTexts()).toEqual([]);
    });

    it('shows no number for a hit on a dummy: the game draws its own', () => {
        const s = session();
        events.length = 0;
        hit(s, 20, T + 50);
        expect(events.filter(e => e.type === 'FLOAT_TEXT')).toEqual([]);
        expect(events.filter(e => e.type === 'DAMAGE')).toHaveLength(1); // the game's, from applyDamage
    });

    it('logs what a break took (hp clamps at 0) and not the restore that follows', () => {
        const s = session();
        const piece = s.state.cover![0];
        const full = piece.hp;
        events.length = 0;
        hitCover(s, 0, full + 400, T + 50);
        expect(piece.hp).toBe(0);
        expect(floatTexts().map(e => (e as { text: string }).text)).toEqual([String(full)]);

        piece.hp = full; // it comes back (the return timer, or R)
        events.length = 0;
        trackRangeDamage(s.memory, s.state, T + 100);
        expect(floatTexts()).toEqual([]);
        expect(s.memory.last[piece.id]).toBe(full);
        expect(recentDamage(s.memory, piece.id, T + 100)).toBe(full);
    });
});
