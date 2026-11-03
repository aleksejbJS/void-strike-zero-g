import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameMode, Platform } from '../../../types';
import { createMockState } from '../../../test/mocks';
import type { DeathEvent, LimbEvent } from '../events';
import { Corpse } from './corpseBody';
import { stepCorpse } from './corpseStep';
import { addCorpse, addLimb, MAX_CORPSES } from './corpses';

const TOP = 500;
const FLOOR: Platform = { id: 'floor', x: -2000, y: TOP, w: 4000, h: 40, color: '#000' };

const death = (extra: Partial<DeathEvent> = {}): DeathEvent => ({
    type: 'DEATH', x: 0, y: TOP, color: '#fff', height: 72, vel: { x: 0, y: 0 }, facing: 1, ...extra,
});

const limb = (extra: Partial<LimbEvent> = {}): LimbEvent => ({
    type: 'LIMB', x: 0, y: TOP, facing: 1, vel: { x: 0, y: 0 }, from: { x: -300, y: TOP - 30 }, ...extra,
});

const run = (c: Corpse, ticks: number) => { for (let i = 0; i < ticks; i++) stepCorpse(c, [FLOOR]); };

// The launch rolls its speeds with Math.random. Each test runs at the lowest and at the highest roll
// (the two ends of every range it draws from) instead of leaving the result to luck.
describe.each([['lowest', 0], ['highest', 0.999999]])('addLimb at the %s random roll', (_name, roll) => {
    beforeEach(() => { vi.spyOn(Math, 'random').mockReturnValue(roll); });
    afterEach(() => { vi.restoreAllMocks(); });

    it('adds one torn-leg corpse: a gib that is only the back leg', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const leg = addLimb(state, limb());
        expect(state.corpses).toEqual([leg]);
        expect(leg.kind).toBe('gib');
        expect(leg.only).toBe('leg-back');
        expect(leg.oneLeg).toBeFalsy();
        expect(leg.weapon).toBeUndefined(); // a leg drops no gun
    });

    it('starts where the back leg stood and keeps the fighter colours', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const parts = { head: '#aa3322', torso: '#3366aa', arm: '#22aa66', leg: '#123456' };
        const leg = addLimb(state, limb({ x: 200, y: 300, parts }));
        expect(leg.colors).toEqual(parts);
        expect(Math.abs(leg.points.knB.x - 200)).toBeLessThan(30);
        expect(Math.abs(leg.points.anB.y - 300)).toBeLessThan(6); // the boot stood on the floor
    });

    it('is thrown like a shot: along the beam, away from where it came from', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const fromLeft = addLimb(state, limb({ from: { x: -300, y: TOP - 40 } }));
        const fromRight = addLimb(state, limb({ from: { x: 300, y: TOP - 40 } }));
        expect(fromLeft.points.knB.x - fromLeft.points.knB.px).toBeGreaterThan(1);
        expect(fromRight.points.knB.x - fromRight.points.knB.px).toBeLessThan(-1);
    });

    it('carries the fighter velocity from before the knockback', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const still = addLimb(state, limb({ from: undefined }));
        const moving = addLimb(state, limb({ from: undefined, vel: { x: 6, y: 0 } }));
        const vx = (c: Corpse) => c.points.hip.x - c.points.hip.px;
        expect(vx(moving)).toBeGreaterThan(vx(still) + 1);
    });

    it('stays one piece, falls and lies on the floor', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const leg = addLimb(state, limb());
        const length = () => Math.hypot(leg.points.knB.x - leg.points.anB.x, leg.points.knB.y - leg.points.anB.y);
        const rest = length();
        run(leg, 300);
        expect(length()).toBeCloseTo(rest, 1);
        for (const id of ['knB', 'anB'] as const) {
            expect(Number.isFinite(leg.points[id].x) && Number.isFinite(leg.points[id].y)).toBe(true);
            expect(leg.points[id].y).toBeLessThanOrEqual(TOP + 0.5);
        }
        expect(leg.points.anB.x).toBeGreaterThan(30); // it flew away from the beam (the beam came from the left)
    });

    it('a missing velocity and origin (older or hostile host) still leave a leg', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const bare = { type: 'LIMB', x: 10, y: TOP, facing: 1 } as unknown as LimbEvent;
        const leg = addLimb(state, bare);
        const points = Object.values(leg.points);
        expect(points.every(p => [p.x, p.y, p.px, p.py].every(Number.isFinite))).toBe(true);
    });

    it('does not make a body fade early, even when the bodies fill the cap', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        for (let i = 0; i < MAX_CORPSES; i++) addCorpse(state, death({ x: i * 100 }));
        addLimb(state, limb());
        expect(state.corpses.every(c => c.fadeAt > c.age)).toBe(true);
    });

    it('does not count toward the corpse cap: the bodies still fill it on their own', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        for (let i = 0; i < 3; i++) addLimb(state, limb());
        for (let i = 0; i < MAX_CORPSES; i++) addCorpse(state, death({ x: i * 100 }));
        expect(state.corpses.every(c => c.fadeAt > c.age)).toBe(true); // 12 bodies and 3 legs: nobody fades yet
        addCorpse(state, death());
        const fading = state.corpses.filter(c => c.fadeAt <= c.age);
        expect(fading).toHaveLength(1);
        expect(fading[0].only).toBeUndefined(); // the oldest body, never a leg
        expect(fading[0]).toBe(state.corpses[3]);
    });
});

describe('a corpse of a one-legged fighter', () => {
    it('remembers it from the DEATH event', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        expect(addCorpse(state, death({ oneLeg: true })).oneLeg).toBe(true);
        expect(addCorpse(state, death({ oneLeg: false })).oneLeg).toBe(false);
    });

    it('has two legs when an older host says nothing', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        expect(addCorpse(state, death()).oneLeg).toBeFalsy();
    });

    it('ignores a oneLeg that is not a boolean (a hostile host must not decide how a body is drawn)', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        for (const bad of ['yes', 1, {}, null, []]) {
            const c = addCorpse(state, { ...death(), oneLeg: bad } as unknown as DeathEvent);
            expect(c.oneLeg, String(bad)).toBeFalsy();
        }
    });
});
