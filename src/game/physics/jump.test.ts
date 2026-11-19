// Jump and double jump in the real loop: Matter collision, fixed 120 ticks/s, the Force Pipeline
import { describe, it, expect } from 'vitest';
import { Entity, Platform, Team } from '../../types';
import { HARD_SPEED_CAP } from '../../constants';
import { createMockPlayer } from '../../test/mocks';
import { applyMovement, MovementInput } from '../systems/movement';
import { FIXED_STEP_MS } from '../systems/fixedStep';
import { MatterPhysicsEngine } from './MatterEngine';

const FLOOR_Y = 500;
const floor: Platform[] = [{ id: 'floor', x: -2000, y: FLOOR_Y, w: 4000, h: 30, color: '' }];
const HEIGHT = 72;

const input = (over: Partial<MovementInput> = {}): MovementInput => ({
    inputX: 0, isFlying: false, wantsJump: false, wantsDown: false, wantsReel: false, wantsExtend: false,
    jumpPress: false, facing: 1, ...over,
});

interface Run { p: Entity; heights: number[]; fuel: number[]; maxHeight: number; landedTick: number | null }

/**
 * Runs `ticks` ticks from standing on the floor (or `lift` px above it). `press(t, p)` says whether the
 * Jump key is freshly pressed on tick t; `move` sets the rest of the input.
 */
const run = (ticks: number, press: (t: number, p: Entity) => boolean, opts: { lift?: number; move?: Partial<MovementInput>; setup?: (p: Entity) => void } = {}): Run => {
    const engine = new MatterPhysicsEngine();
    floor.forEach(f => engine.addPlatform(f));
    const p: Entity = createMockPlayer('p', Team.NONE);
    p.pos = { x: 0, y: FLOOR_Y - (opts.lift ?? 0) };
    opts.setup?.(p);
    engine.addPlayer(p);
    const heights: number[] = [];
    const fuel: number[] = [];
    let landedTick: number | null = null;
    let left = false;
    for (let t = 0; t < ticks; t++) {
        engine.step(FIXED_STEP_MS);
        engine.syncGameState({ platforms: floor, players: [p] });
        applyMovement(p, input({ ...opts.move, jumpPress: press(t, p) }));
        engine.syncFromGameState({ players: [p] });
        const h = FLOOR_Y - p.pos.y;
        heights.push(h);
        fuel.push(p.jetpackFuel);
        if (h > 5) left = true;
        if (left && landedTick === null && h < 1) landedTick = t;
    }
    return { p, heights, fuel, maxHeight: Math.max(...heights), landedTick };
};

/** Presses on tick 0 and again on the first tick the rise has stopped. */
const doubleAtTop = () => {
    let second: number | null = null;
    return (t: number, p: Entity) => {
        if (t === 0) return true;
        if (second === null && t > 2 && p.vel.y >= 0) { second = t; return true; }
        return false;
    };
};

describe('jump', () => {
    it('a ground jump peaks at about 1.5 fighter heights and lands within 2 s', () => {
        const r = run(240, t => t === 0);
        expect(r.maxHeight).toBeGreaterThan(1.5 * HEIGHT * 0.9);
        expect(r.maxHeight).toBeLessThan(1.5 * HEIGHT * 1.1);
        expect(r.landedTick).not.toBeNull();
    });

    it('a double jump at the top adds about one more height', () => {
        const r = run(300, doubleAtTop());
        expect(r.maxHeight).toBeGreaterThan(2.5 * HEIGHT * 0.9);
        expect(r.maxHeight).toBeLessThan(2.5 * HEIGHT * 1.1);
    });

    it('allows only one air jump per airtime, a landing gives it back', () => {
        const top = doubleAtTop();
        const two = run(300, doubleAtTop());
        const three = run(300, (t, p) => top(t, p) || t === 60);
        expect(three.maxHeight).toBeCloseTo(two.maxHeight, 0);

        const again = run(500, t => t === 0 || t === 400);
        expect(again.landedTick).not.toBeNull();
        expect(Math.max(...again.heights.slice(400))).toBeGreaterThan(HEIGHT);
    });

    it('still allows the air jump after walking off a ledge', () => {
        const once = run(60, t => t === 5, { lift: 300, setup: p => { p.isGrounded = false; } });
        expect(once.heights[20]).toBeGreaterThan(once.heights[5]);
        expect(once.p.airJump).toBe(1);
        const twice = run(60, t => t === 5 || t === 10, { lift: 300, setup: p => { p.isGrounded = false; } });
        expect(twice.heights[30]).toBeCloseTo(once.heights[30], 0);
    });

    it('burns no fuel', () => {
        // On the floor the tank refills, so the fuel may only ever go up
        const r = run(300, doubleAtTop(), { setup: p => { p.jetpackFuel = 50; } });
        r.fuel.forEach((f, i) => expect(f).toBeGreaterThanOrEqual(i ? r.fuel[i - 1] : 50));
    });

    it('stores the flip direction of the air jump and clears it on landing', () => {
        const left = run(40, t => t === 0 || t === 20, { move: { inputX: -1 } });
        expect(left.p.airJump).toBe(-1);
        const facing = run(40, t => t === 0 || t === 20, { move: { facing: 1 } });
        expect(facing.p.airJump).toBe(1);
        const landed = run(300, t => t === 0 || t === 20);
        expect(landed.p.airJump).toBe(0);
    });

    it('does not jump on the hook or with one leg', () => {
        const hooked = run(20, t => t === 0, { setup: p => { p.grapple.active = true; p.grapple.pos = { x: 0, y: 0 }; p.grapple.length = 500; } });
        expect(Math.max(...hooked.heights)).toBeLessThan(2);
        const wounded = run(20, t => t === 0, { setup: p => { p.wound = { by: 'test' }; } });
        expect(Math.max(...wounded.heights)).toBeLessThan(2);
    });
});

describe('speed cap', () => {
    it('the jetpack keeps today\'s upward cap', () => {
        const engine = new MatterPhysicsEngine();
        floor.forEach(f => engine.addPlatform(f));
        const p = createMockPlayer('p', Team.NONE);
        p.pos = { x: 0, y: FLOOR_Y };
        p.jetpackFuel = p.maxFuel = 1e9;
        engine.addPlayer(p);
        for (let t = 0; t < 120; t++) {
            engine.step(FIXED_STEP_MS);
            engine.syncGameState({ platforms: floor, players: [p] });
            applyMovement(p, input({ isFlying: true, wantsJump: true }));
            engine.syncFromGameState({ players: [p] });
            expect(p.vel.y).toBeGreaterThanOrEqual(-HARD_SPEED_CAP);
        }
    });

    it('a jump followed by the jetpack is back under the jetpack\'s cap once the jump has slowed down', () => {
        const engine = new MatterPhysicsEngine();
        floor.forEach(f => engine.addPlatform(f));
        const p = createMockPlayer('p', Team.NONE);
        p.pos = { x: 0, y: FLOOR_Y };
        p.jetpackFuel = p.maxFuel = 1e9;
        engine.addPlayer(p);
        for (let t = 0; t < 200; t++) {
            engine.step(FIXED_STEP_MS);
            engine.syncGameState({ platforms: floor, players: [p] });
            const w = t >= 1;
            applyMovement(p, input({ jumpPress: t === 0, isFlying: w, wantsJump: w }));
            engine.syncFromGameState({ players: [p] });
            // A jump starts at 12.3 and gravity slows it below 8 within ~12 ticks: the jetpack may not keep it faster
            if (t >= 15) expect(p.vel.y).toBeGreaterThanOrEqual(-HARD_SPEED_CAP);
        }
    });

    it('upward knock-back outside a jump stays capped', () => {
        const p = createMockPlayer('p', Team.NONE);
        p.isGrounded = false;
        p.vel = { x: 0, y: -15 };
        applyMovement(p, input());
        expect(p.vel.y).toBe(-HARD_SPEED_CAP);
    });
});
