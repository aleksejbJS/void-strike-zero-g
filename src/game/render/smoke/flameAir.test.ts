import { describe, it, expect } from 'vitest';
import { flameAirOf } from './flameAir';
import { FlameSim } from '../flame/flameSim';
import { FlameOrders } from '../flame/flameOrders';

const DT = 1 / 120;

describe('flameAirOf', () => {
    it('lists each stream with its nozzle, aim, trigger and power', () => {
        const sim = new FlameSim();
        const orders = new FlameOrders();
        orders.stream('a', { x: 10, y: 20, angle: 1.5, firing: true });
        orders.stream('b', { x: 30, y: 40, angle: 0, firing: false });
        sim.update(DT, orders, []);
        const air = flameAirOf(sim.streams, sim.pools.smoke);
        const got = [...air.streams()];
        expect(got.length).toBe(2);
        const a = got.find(s => s.x === 10)!;
        expect(a).toMatchObject({ y: 20, angle: 1.5, firing: true });
        expect(a.power).toBeGreaterThan(0);
        expect(got.find(s => s.x === 30)).toMatchObject({ y: 40, firing: false });
    });

    it('lists only the live smoke particles of the flame engine', () => {
        const sim = new FlameSim();
        const air = flameAirOf(sim.streams, sim.pools.smoke);
        expect([...air.soot()].length).toBe(0);
        const p = sim.pools.smoke.get()!;
        p.x = 5; p.y = 6;
        const q = sim.pools.smoke.get()!;
        q.x = 7; q.y = 8;
        expect([...air.soot()].map(s => [s.x, s.y]).sort()).toEqual([[5, 6], [7, 8]]);
        sim.pools.smoke.kill(p);
        expect([...air.soot()].map(s => [s.x, s.y])).toEqual([[7, 8]]);
    });

    it('says whether any smoke particle is alive, and gives each one its age and life span', () => {
        const sim = new FlameSim();
        const air = flameAirOf(sim.streams, sim.pools.smoke);
        expect(air.hasSoot()).toBe(false);
        const p = sim.pools.smoke.get()!;
        p.age = 0.5; p.ttl = 2;
        expect(air.hasSoot()).toBe(true);
        expect([...air.soot()].map(s => [s.age, s.ttl])).toEqual([[0.5, 2]]);
        sim.pools.smoke.kill(p);
        expect(air.hasSoot()).toBe(false);
    });

    it('sees a stream spray soot into the smoke pool', () => {
        const sim = new FlameSim();
        const orders = new FlameOrders();
        for (let t = 0; t < 1; t += DT) {
            orders.stream('a', { x: 0, y: 0, angle: 0, firing: true });
            sim.update(DT, orders, []);
            orders.clear();
        }
        const air = flameAirOf(sim.streams, sim.pools.smoke);
        expect([...air.soot()].length).toBe(sim.pools.smoke.count);
        expect(sim.pools.smoke.count).toBeGreaterThan(0);
    });
});
