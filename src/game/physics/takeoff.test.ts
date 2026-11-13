// Taking off from the floor on the jetpack is as quick as the same thrust already in the air
import { describe, it, expect } from 'vitest';
import { Entity, Platform, Team } from '../../types';
import { createMockPlayer } from '../../test/mocks';
import { applyMovement, MovementInput } from '../systems/movement';
import { FIXED_STEP_MS } from '../systems/fixedStep';
import { MatterPhysicsEngine } from './MatterEngine';

const FLOOR_Y = 500;
const floor: Platform[] = [{ id: 'floor', x: -2000, y: FLOOR_Y, w: 4000, h: 30, color: '' }];

const input = (over: Partial<MovementInput>): MovementInput => ({
    inputX: 0, isFlying: false, wantsJump: false, wantsDown: false, wantsReel: false, wantsExtend: false, ...over,
});

/** Height above the floor and horizontal speed after each tick of holding `move`, starting `lift` units up. */
const fly = (move: MovementInput, lift: number, ticks: number) => {
    const engine = new MatterPhysicsEngine();
    floor.forEach(p => engine.addPlatform(p));
    const p: Entity = createMockPlayer('p', Team.NONE);
    p.pos = { x: 0, y: FLOOR_Y - lift };
    p.jetpackFuel = p.maxFuel = 1e9;
    engine.addPlayer(p);
    const out: { height: number; vx: number }[] = [];
    for (let t = 0; t < ticks; t++) {
        engine.step(FIXED_STEP_MS);
        engine.syncGameState({ platforms: floor, players: [p] });
        applyMovement(p, move);
        engine.syncFromGameState({ players: [p] });
        out.push({ height: FLOOR_Y - p.pos.y, vx: p.vel.x });
    }
    return out;
};

describe('jetpack takeoff', () => {
    for (const [label, move] of [
        ['straight up (W)', input({ isFlying: true, wantsJump: true })],
        ['diagonally (W + D)', input({ isFlying: true, wantsJump: true, inputX: 1 })],
    ] as const) {
        it(`${label} from the floor climbs like the same thrust started just above it`, () => {
            const ground = fly(move, 0, 30);
            const air = fly(move, 4, 30);
            // Started 4 units higher, so the airborne run may lead by about that much, no more
            expect(air[29].height - ground[29].height).toBeLessThan(6);
        });
    }

    it('a diagonal takeoff keeps its sideways speed instead of braking on the floor', () => {
        const ground = fly(input({ isFlying: true, wantsJump: true, inputX: 1 }), 0, 30);
        const air = fly(input({ isFlying: true, wantsJump: true, inputX: 1 }), 4, 30);
        expect(ground[29].vx).toBeGreaterThan(air[29].vx * 0.9);
    });

    it('standing still or diving down on the floor stays grounded', () => {
        const stand = fly(input({}), 0, 30);
        const dive = fly(input({ isFlying: true, wantsDown: true, inputX: 1 }), 0, 30);
        expect(Math.max(...stand.map(s => Math.abs(s.height)))).toBeLessThan(1);
        expect(Math.max(...dive.map(s => Math.abs(s.height)))).toBeLessThan(1);
    });
});
