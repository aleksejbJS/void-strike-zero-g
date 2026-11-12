// A fighter moving along the seam between two flush blocks keeps its speed (sharp box corners snagged there)
import { describe, it, expect } from 'vitest';
import { Entity, Platform, Team } from '../../types';
import { createMockPlayer } from '../../test/mocks';
import { applyMovement, MovementInput } from '../systems/movement';
import { FIXED_STEP_MS } from '../systems/fixedStep';
import { MatterPhysicsEngine } from './MatterEngine';

const block = (id: string, x: number, y: number, w: number, h: number): Platform => ({ id, x, y, w, h, color: '' });

const input = (over: Partial<MovementInput>): MovementInput => ({
    inputX: 0, isFlying: false, wantsJump: false, wantsDown: false, wantsReel: false, wantsExtend: false, ...over,
});

/** Run the real tick order (Matter step → read → Force Pipeline → write) and return the player after each tick. */
const simulate = (platforms: Platform[], start: { x: number; y: number }, move: MovementInput, ticks: number) => {
    const engine = new MatterPhysicsEngine();
    platforms.forEach(p => engine.addPlatform(p));
    const p: Entity = createMockPlayer('p', Team.NONE);
    p.pos = { ...start };
    p.jetpackFuel = p.maxFuel = 1e9;
    engine.addPlayer(p);
    const states: { x: number; y: number; vx: number; vy: number }[] = [];
    for (let t = 0; t < ticks; t++) {
        engine.step(FIXED_STEP_MS);
        engine.syncGameState({ platforms, players: [p] });
        applyMovement(p, move);
        engine.syncFromGameState({ players: [p] });
        states.push({ x: p.pos.x, y: p.pos.y, vx: p.vel.x, vy: p.vel.y });
    }
    return states;
};

/** Slowest horizontal speed while the box spans the seam at x = 200, as a share of the speed just before it. */
const keptOverSeam = (states: ReturnType<typeof simulate>) => {
    const before = states.filter(s => s.x > 140 && s.x < 170);
    const over = states.filter(s => s.x > 170 && s.x < 230);
    expect(before.length).toBeGreaterThan(0);
    expect(over.length).toBeGreaterThan(0);
    return Math.min(...over.map(s => s.vx)) / before[before.length - 1].vx;
};

describe('flush block seams', () => {
    it('a jetpack flight with the head against a ceiling seam keeps its speed', () => {
        const ceiling = [block('a', -400, 300, 600, 30), block('b', 200, 300, 600, 30)];
        const states = simulate(ceiling, { x: 0, y: 410 }, input({ inputX: 1, isFlying: true }), 400);
                expect(keptOverSeam(states)).toBeGreaterThan(0.95);
    });

    it('running over a floor seam keeps its speed', () => {
        const floor = [block('a', -400, 500, 600, 30), block('b', 200, 500, 600, 30)];
        const states = simulate(floor, { x: 0, y: 500 }, input({ inputX: 1 }), 240);
        expect(keptOverSeam(states)).toBeGreaterThan(0.95);
        expect(states.every(s => Math.abs(s.y - 500) < 1)).toBe(true);
    });

    it('diving along a floor seam keeps its speed', () => {
        const floor = [block('a', -400, 500, 600, 30), block('b', 200, 500, 600, 30)];
        const states = simulate(floor, { x: 0, y: 499 }, input({ inputX: 1, isFlying: true, wantsDown: true }), 200);
        expect(keptOverSeam(states)).toBeGreaterThan(0.95);
    });

    it('falling down a wall of two stacked blocks does not catch on their seam', () => {
        const wall = [block('a', 100, 0, 30, 400), block('b', 100, 400, 30, 400)];
        const states = simulate(wall, { x: 84, y: 200 }, input({ inputX: 1 }), 200);
        const overSeam = states.filter(s => s.y > 380 && s.y < 480);
        expect(overSeam.length).toBeGreaterThan(0);
        expect(Math.min(...overSeam.map(s => s.vy))).toBeGreaterThan(7);
    });
});
