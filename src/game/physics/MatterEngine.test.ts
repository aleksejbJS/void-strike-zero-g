import { describe, it, expect } from 'vitest';
import { Team } from '../../types';
import { createMockPlayer } from '../../test/mocks';
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
