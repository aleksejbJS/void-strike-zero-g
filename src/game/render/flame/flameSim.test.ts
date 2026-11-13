import { describe, expect, it } from 'vitest';
import { FlameSim } from './flameSim';
import { FlameOrders } from './flameOrders';
import type { Surface } from './particleMotion';
import { FLAME_RANGE } from '../../systems/flameConstants';
import { PATCH, POOL } from './flameTuning';

const DT = 1 / 120;

/** Run `sim` for `seconds`, giving the same orders every frame. */
const run = (sim: FlameSim, seconds: number, fill: (o: FlameOrders) => void, surfaces: Surface[] = []) => {
    const orders = new FlameOrders();
    for (let t = 0; t < seconds; t += DT) {
        fill(orders);
        sim.update(DT, orders, surfaces);
        orders.clear();
    }
};

const sprayRight = (o: FlameOrders) => o.stream('a', { x: 0, y: 0, angle: 0, firing: true });

/** The x below which `share` of the visible flame (by alpha) lies. */
const alphaQuantile = (sim: FlameSim, share: number): number => {
    const live = sim.pools.fire.items.filter(p => p.alive).sort((a, b) => a.x - b.x);
    const total = live.reduce((s, p) => s + p.alpha, 0);
    let acc = 0;
    for (const p of live) {
        acc += p.alpha;
        if (acc >= total * share) return p.x;
    }
    return 0;
};

describe('the drawn flame stream', () => {
    it('ends where the damage ends: the bright body fills most of FLAME_RANGE and the faint tail stops at it', () => {
        const sim = new FlameSim();
        run(sim, 1.5, sprayRight);
        expect(alphaQuantile(sim, 0.9)).toBeGreaterThan(FLAME_RANGE * 0.6);
        expect(alphaQuantile(sim, 0.9)).toBeLessThan(FLAME_RANGE * 0.85);
        expect(alphaQuantile(sim, 0.99)).toBeGreaterThan(FLAME_RANGE * 0.85);
        expect(alphaQuantile(sim, 0.99)).toBeLessThan(FLAME_RANGE * 1.15);
    });

    it('sprays cores, nozzle streaks, sparks and smoke', () => {
        const sim = new FlameSim();
        run(sim, 1, sprayRight);
        const { fire, jet, spark, smoke } = sim.pools;
        expect(fire.count).toBeGreaterThan(200);
        expect(jet.items.some(p => p.alive && !p.pilot)).toBe(true);
        expect(spark.count).toBeGreaterThan(5);
        expect(smoke.count).toBeGreaterThan(20);
    });

    it('shows only the pilot light while the flamethrower is held but not firing', () => {
        const sim = new FlameSim();
        run(sim, 1, o => o.stream('a', { x: 0, y: 0, angle: 0, firing: false }));
        expect(sim.pools.fire.count).toBe(0);
        const jets = sim.pools.jet.items.filter(p => p.alive);
        expect(jets.length).toBeGreaterThan(0);
        expect(jets.every(p => p.pilot)).toBe(true);
    });

    it('dies out and forgets the stream once the fighter stops asking for it', () => {
        const sim = new FlameSim();
        run(sim, 0.5, sprayRight);
        run(sim, 2, () => undefined);
        expect(sim.streams.size).toBe(0);
        expect(sim.pools.fire.count).toBe(0);
    });

    it('stops at a wall, leaves short splash fire there and then a soot mark', () => {
        const sim = new FlameSim();
        const wall: Surface = { x: 150, y: -200, w: 40, h: 400 };
        run(sim, 1, sprayRight, [wall]);
        const fire = sim.pools.fire.items.filter(p => p.alive);
        expect(fire.every(p => p.x <= wall.x + 1)).toBe(true);
        expect(sim.patches.items.some(q => q.active && q.body === null && q.nx === -1)).toBe(true);
        // the stream takes ~1 s to die out, its last cores still feed the fire, which then burns up to burnTime × 1.2
        run(sim, 1.5 + PATCH.burnTime * 1.2, () => undefined, [wall]);
        expect(sim.burning).toBe(0);
        expect(sim.marks.items.some(m => m.active)).toBe(true);
    });

    it('never holds more particles than its pools, and a lower quality uses less', () => {
        const high = new FlameSim('high');
        const low = new FlameSim('low');
        const six = (o: FlameOrders) => { for (let i = 0; i < 6; i++) o.stream(`f${i}`, { x: 0, y: i * 50, angle: 0, firing: true }); };
        run(high, 1, six);
        run(low, 1, six);
        expect(high.pools.fire.count).toBeLessThanOrEqual(POOL.fire);
        expect(low.pools.fire.count).toBeLessThanOrEqual(Math.ceil(POOL.fire * 0.34));
        expect(low.pools.fire.count).toBeLessThan(high.pools.fire.count);
    });
});

describe('a burning fighter', () => {
    const burn = (o: FlameOrders) => o.body('b', { x: 100, y: 500, w: 30, h: 72, prone: false });

    it('carries one fire that follows the body', () => {
        const sim = new FlameSim();
        run(sim, 0.5, burn);
        run(sim, 0.2, o => o.body('b', { x: 160, y: 500, w: 30, h: 72, prone: false }));
        const fires = sim.patches.items.filter(q => q.active && q.body === 'b');
        expect(fires).toHaveLength(1);
        expect(fires[0].x).toBe(160);
        expect(fires[0].hBase).toBeGreaterThan(50);
        expect(sim.pools.fire.count).toBeGreaterThan(0);
    });

    it('goes out shortly after the burn ends and leaves no soot', () => {
        const sim = new FlameSim();
        run(sim, 0.5, burn);
        run(sim, PATCH.bodyFade + 0.05, () => undefined);
        expect(sim.burning).toBe(0);
        expect(sim.marks.items.some(m => m.active)).toBe(false);
    });
});

describe('thin platforms', () => {
    it('stop the flame even on a slow frame, when a core flies further than the platform is thick', () => {
        const sim = new FlameSim();
        const floor: Surface = { x: -200, y: 60, w: 600, h: 12 };
        const orders = new FlameOrders();
        for (let t = 0; t < 1; t += 0.05) { // 20 fps: a fresh core flies ~35 px a frame
            orders.stream('a', { x: 0, y: 0, angle: Math.PI / 2.5, firing: true });
            sim.update(0.05, orders, [floor]);
            orders.clear();
        }
        const below = sim.pools.fire.items.filter(p => p.alive && p.y > floor.y + floor.h);
        expect(below).toHaveLength(0);
    });
});
