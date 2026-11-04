import { describe, it, expect } from 'vitest';
import { Entity, Team } from '../../types';
import { createMockPlayer } from '../../test/mocks';
import { GRAVITY } from '../../constants';
import { Cover } from '../cover/coverTypes';
import { coverRect } from '../cover/coverGeometry';
import { FIXED_STEP_MS } from '../systems/fixedStep';
import { MatterPhysicsEngine } from './MatterEngine';

describe('MatterPhysicsEngine crouch', () => {
    it('resizes the body to the player height, keeping feet in place', () => {
        const engine = new MatterPhysicsEngine();
        const p = createMockPlayer('p1', Team.NONE);
        p.pos = { x: 0, y: 100 };
        engine.addPlayer(p);

        p.height = 45;
        engine.syncFromGameState({ players: [p] });

        const body = engine.bodies.get('p1')!;
        expect(body.bounds.max.y - body.bounds.min.y).toBeCloseTo(45, 1);
        expect(body.bounds.max.y).toBeCloseTo(100, 1);
        expect(body.inertia).toBe(Infinity);

        p.height = 72;
        engine.syncFromGameState({ players: [p] });

        expect(body.bounds.max.y - body.bounds.min.y).toBeCloseTo(72, 1);
        expect(body.bounds.max.y).toBeCloseTo(100, 1);
    });
});

describe('MatterPhysicsEngine dead players', () => {
    it('stop colliding while dead and collide again after respawn', () => {
        const engine = new MatterPhysicsEngine();
        const p = createMockPlayer('p1', Team.NONE);
        engine.addPlayer(p);
        const body = engine.bodies.get('p1')!;

        p.dead = true;
        engine.syncFromGameState({ players: [p] });
        expect(body.isSensor).toBe(true);

        p.dead = false;
        engine.syncFromGameState({ players: [p] });
        expect(body.isSensor).toBe(false);
    });
});

describe('MatterPhysicsEngine cover', () => {
    const crate = (): Cover => ({ id: 'crate', kind: 'wood', pos: { x: 500, y: 400 }, hp: 150 });

    // One tick as the server runs it: Matter step, read back, Force Pipeline gravity, push to Matter
    const run = (engine: MatterPhysicsEngine, p: Entity, cover: Cover[], ticks: number) => {
        const state = { platforms: [], players: [p], cover };
        for (let i = 0; i < ticks; i++) {
            engine.step(FIXED_STEP_MS);
            engine.syncGameState(state);
            if (!p.isGrounded) p.vel.y += GRAVITY;
            else if (p.vel.y <= 0) p.vel.y = 0.1;
            engine.syncFromGameState(state);
        }
    };

    const dropAbove = (engine: MatterPhysicsEngine, feetY: number) => {
        const p = createMockPlayer('p1', Team.NONE);
        p.pos = { x: 500, y: feetY };
        engine.addPlayer(p);
        return p;
    };

    it('adds a static body for intact cover and removes it when the piece breaks', () => {
        const engine = new MatterPhysicsEngine();
        const c = crate();
        engine.syncFromGameState({ players: [], cover: [c] });

        const body = engine.bodies.get('crate')!;
        expect(body.isStatic).toBe(true);
        const r = coverRect(c);
        expect(body.position.x).toBeCloseTo(r.x + r.w / 2, 5);
        expect(body.position.y).toBeCloseTo(r.y + r.h / 2, 5);

        engine.syncFromGameState({ players: [], cover: [c] }); // a second sync adds nothing
        expect(engine.bodies.size).toBe(1);

        c.hp = 0;
        engine.syncFromGameState({ players: [], cover: [c] });
        expect(engine.bodies.has('crate')).toBe(false);

        c.hp = 150; // the piece returns
        engine.syncFromGameState({ players: [], cover: [c] });
        expect(engine.bodies.has('crate')).toBe(true);
    });

    it('leaves cover bodies alone when a sync does not mention cover (client prediction of one fighter)', () => {
        const engine = new MatterPhysicsEngine();
        engine.syncFromGameState({ players: [], cover: [crate()] });
        engine.syncFromGameState({ players: [] });
        expect(engine.bodies.has('crate')).toBe(true);
    });

    it('fighter lands on a crate', () => {
        const engine = new MatterPhysicsEngine();
        const cover = [crate()];
        engine.syncFromGameState({ players: [], cover });
        const p = dropAbove(engine, 250);

        run(engine, p, cover, 240);

        expect(Math.abs(p.pos.y - 354)).toBeLessThanOrEqual(4); // feet on the crate top
        expect(p.isGrounded).toBe(true);
    });

    it('fighter on a crate falls when it breaks', () => {
        const engine = new MatterPhysicsEngine();
        const cover = [crate()];
        engine.syncFromGameState({ players: [], cover });
        const p = dropAbove(engine, 250);
        run(engine, p, cover, 240);
        expect(p.isGrounded).toBe(true);

        cover[0].hp = 0;
        engine.syncFromGameState({ players: [p], cover });
        expect(engine.bodies.has('crate')).toBe(false);

        run(engine, p, cover, 30);

        expect(p.pos.y).toBeGreaterThan(354 + 10);
        expect(p.isGrounded).toBe(false); // falling, nothing under the feet
    });
});
