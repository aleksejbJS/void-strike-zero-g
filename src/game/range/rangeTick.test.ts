import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Entity } from '../../types';
import { applyDamage } from '../systems/combat';
import { DUMMY_SPOTS } from './rangeMap';
import { DUMMY_RETURN_MS } from './rangeState';
import { tickRange } from './rangeTick';
import { LOCAL_ID, NORMAL_SPAWN, physicsTick, rangeFixture } from './rangeTestKit';
import type { RangeFixture } from './rangeTestKit';

const T = 1_000_000;
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(T); });
afterEach(() => { vi.useRealTimers(); });

const NO_PUSH = { x: 0, y: 0 };

/** The range loop as GameCanvas runs it: set the clock, tickRange, then the physics. */
const step = ({ state }: RangeFixture, at: number) => {
    vi.setSystemTime(at);
    tickRange(state, LOCAL_ID, at);
    physicsTick(state);
};

/** A real lethal hit on `dummy` at the current clock, then the tick that sees the body. */
const kill = (fx: RangeFixture, dummy: Entity) => {
    applyDamage(fx.state, dummy, LOCAL_ID, 9999, NO_PUSH);
    expect(dummy.dead).toBe(true);
    tickRange(fx.state, LOCAL_ID, Date.now());
};

describe('tickRange: the local fighter', () => {
    it('refills every weapon and the jetpack after a shot', () => {
        const { state, local } = rangeFixture();
        local.inventory.forEach(w => { w.ammo = 0; });
        local.jetpackFuel = 3;
        tickRange(state, LOCAL_ID, T);
        local.inventory.forEach(w => expect(w.ammo).toBe(w.maxAmmo));
        expect(local.inventory.length).toBeGreaterThan(1);
        expect(local.jetpackFuel).toBe(local.maxFuel);
    });

    it('does nothing without a range record or a local fighter', () => {
        const fx = rangeFixture();
        fx.state.players = fx.dummies;
        expect(() => tickRange(fx.state, LOCAL_ID, T)).not.toThrow();
        delete fx.state.range;
        expect(() => tickRange(fx.state, LOCAL_ID, T)).not.toThrow();
    });});

describe('tickRange: a killed dummy', () => {
    it('stays dead for 2999 ms and stands on its own spot at 3000 ms', () => {
        const fx = rangeFixture();
        const dummy = fx.dummies[2];
        kill(fx, dummy);

        step(fx, T + DUMMY_RETURN_MS - 1);
        expect(dummy.dead).toBe(true);
        expect(dummy.pos).toEqual(DUMMY_SPOTS[2].pos);

        step(fx, T + DUMMY_RETURN_MS);
        expect(dummy).toMatchObject({ dead: false, health: 100 });
        expect(dummy.pos).toEqual(DUMMY_SPOTS[2].pos);
        expect(dummy.pos).not.toBe(DUMMY_SPOTS[2].pos);
        expect(fx.range.diedAt).toEqual({});
    });

    it('is held out of the normal respawn, which would send it to the spawn point', () => {
        const fx = rangeFixture();
        const dummy = fx.dummies[0];
        kill(fx, dummy);
        expect(dummy.respawnTimer).toBe(Number.MAX_SAFE_INTEGER);

        vi.setSystemTime(T + 60_000); // long past the normal respawn delay, and no tickRange in between
        physicsTick(fx.state);

        expect(dummy.dead).toBe(true);
        expect(dummy.pos).toEqual(DUMMY_SPOTS[0].pos);
        expect(dummy.pos).not.toEqual(NORMAL_SPAWN);
    });

    it('counts the 3 s from each dummy\'s own death', () => {
        const fx = rangeFixture();
        kill(fx, fx.dummies[0]);
        vi.setSystemTime(T + 1000);
        kill(fx, fx.dummies[1]);

        step(fx, T + DUMMY_RETURN_MS);
        expect(fx.dummies[0].dead).toBe(false);
        expect(fx.dummies[1].dead).toBe(true);
        step(fx, T + 1000 + DUMMY_RETURN_MS);
        expect(fx.dummies[1].dead).toBe(false);
    });

    it('comes back prone after the next physics tick when it was killed prone', () => {
        const fx = rangeFixture();
        const dummy = fx.dummies[0];
        fx.range.stance = 'prone';
        step(fx, T);
        expect(dummy.isProne).toBe(true);
        kill(fx, dummy);

        vi.setSystemTime(T + DUMMY_RETURN_MS);
        tickRange(fx.state, LOCAL_ID, T + DUMMY_RETURN_MS);
        expect(dummy.dead).toBe(false);
        physicsTick(fx.state);

        expect(dummy.isProne).toBe(true);
        expect(dummy.height).toBe(26);
    });

    it('comes back in the stance chosen while it lay dead', () => {
        const fx = rangeFixture();
        const dummy = fx.dummies[0];
        step(fx, T);
        kill(fx, dummy);
        fx.range.stance = 'crouch';
        step(fx, T + DUMMY_RETURN_MS);
        expect(dummy.dead).toBe(false);
        expect(dummy.isCrouching).toBe(true);
    });
});

describe('tickRange: R', () => {
    it('resets at once, clears the flag, and revives a dead dummy only once', () => {
        const fx = rangeFixture();
        const dummy = fx.dummies[0];
        kill(fx, dummy);

        fx.range.resetRequested = true;
        step(fx, T + 1000);
        expect(fx.range.resetRequested).toBe(false);
        expect(dummy).toMatchObject({ dead: false, health: 100 });
        expect(fx.range.diedAt).toEqual({});

        // Hurt at +2 s: the old +3 s deadline must not reset it again
        vi.setSystemTime(T + 2000);
        applyDamage(fx.state, dummy, LOCAL_ID, 30, NO_PUSH);
        step(fx, T + DUMMY_RETURN_MS);
        expect(dummy.health).toBe(70);
        expect(dummy.dead).toBe(false);
    });

    it('gives a dummy killed again after R a full 3 s of its own', () => {
        const fx = rangeFixture();
        const dummy = fx.dummies[0];
        kill(fx, dummy);
        fx.range.resetRequested = true;
        step(fx, T + 1000);

        vi.setSystemTime(T + 2000);
        kill(fx, dummy);
        step(fx, T + DUMMY_RETURN_MS); // the first death's deadline
        expect(dummy.dead).toBe(true);
        step(fx, T + 2000 + DUMMY_RETURN_MS);
        expect(dummy.dead).toBe(false);
    });
});

describe('tickRange: the armour toggle', () => {
    it('sets 100 on all living dummies once; damage lowers it and the next tick does not refill', () => {
        const fx = rangeFixture();
        fx.range.armored = true;
        step(fx, T);
        fx.dummies.forEach(d => expect(d.armor).toBe(100));

        applyDamage(fx.state, fx.dummies[0], LOCAL_ID, 20, NO_PUSH);
        const soaked = fx.dummies[0].armor;
        expect(soaked).toBeLessThan(100);
        step(fx, T + 8);
        step(fx, T + 16);
        expect(fx.dummies[0].armor).toBe(soaked);
        expect(fx.dummies[1].armor).toBe(100);
    });

    it('takes the armour off again when K is pressed a second time', () => {
        const fx = rangeFixture();
        fx.range.armored = true;
        step(fx, T);
        fx.range.armored = false;
        step(fx, T + 8);
        fx.dummies.forEach(d => expect(d.armor).toBe(0));
    });

    it('brings a dummy killed in armour back armoured, and does not refill it later', () => {
        const fx = rangeFixture();
        fx.range.armored = true;
        step(fx, T);
        kill(fx, fx.dummies[0]);
        step(fx, T + DUMMY_RETURN_MS);
        expect(fx.dummies[0]).toMatchObject({ dead: false, armor: 100 });

        applyDamage(fx.state, fx.dummies[0], LOCAL_ID, 20, NO_PUSH);
        const soaked = fx.dummies[0].armor;
        step(fx, T + DUMMY_RETURN_MS + 8);
        expect(fx.dummies[0].armor).toBe(soaked);
    });
});
