import { describe, expect, it } from 'vitest';
import { nearbySurfaces } from './flameSurfaces';
import { FlameOrders } from './flameOrders';
import { FlameSim } from './flameSim';
import { piece } from '../../cover/coverTestKit';
import type { Platform } from '../../../types';

const plat = (id: string, x: number, y: number): Platform => ({ id, x, y, w: 100, h: 20, color: '#000' });

describe('nearbySurfaces', () => {
    const world = {
        platforms: [plat('near', 50, 30), plat('far', 5000, 30)],
        cover: [piece('crate', 'wood', 60, 0), piece('broken', 'wood', 90, 0, 0)],
    };

    it('is empty while nothing burns', () => {
        const sim = new FlameSim();
        expect(nearbySurfaces(world, sim.pools, new FlameOrders(), [])).toHaveLength(0);
    });

    it('holds the platforms and intact cover near a nozzle, not far ones or broken cover', () => {
        const sim = new FlameSim();
        const orders = new FlameOrders();
        orders.stream('a', { x: 0, y: 0, angle: 0, firing: true });
        const out = nearbySurfaces(world, sim.pools, orders, []);
        expect(out).toContain(world.platforms[0]);
        expect(out).not.toContain(world.platforms[1]);
        expect(out).toHaveLength(2); // the near platform and the intact crate
    });
});
