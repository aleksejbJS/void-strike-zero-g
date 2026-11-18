import { describe, it, expect } from 'vitest';
import { AirGrid, type Stir } from './airGrid';
import { GridDriver } from './gridDriver';
import { StepBudget } from './stepBudget';
import { STEP_HZ } from './smokeTuning';

const make = () => {
    const grid = new AirGrid(8, 0, 0, 80), box = { x: 0, y: 0, w: 80, h: 80 };
    const steps: number[] = [], pushes: { st: Stir; dt: number }[] = [];
    grid.step = (dt: number) => { steps.push(dt); };
    grid.stir = (st: Stir, dt: number) => { pushes.push({ st, dt }); };
    return { grid, box, driver: new GridDriver(grid, box, 0), steps, pushes };
};
const stir = (x: number, dt?: number): Stir => ({ x, y: 40, r: 10, vx: 1, vy: 0, rate: 1, dt });

describe('GridDriver', () => {
    it('queues only the stirs that reach the box, and applies each once, before the first step, for the time it carries', () => {
        const { driver, steps, pushes } = make();
        driver.queueStirs([stir(40, 0.004), stir(500, 0.004), stir(-5, 0.002)]);   // the second misses; the third touches the edge
        const n = driver.due(1000 / STEP_HZ * 2, true);
        expect(n).toBe(2);
        driver.run(1000 / STEP_HZ * 2, n);
        expect(pushes.map(p => [p.st.x, p.dt])).toEqual([[40, 0.004], [-5, 0.002]]);
        expect(steps.length).toBe(2);
        driver.run(1000, 0);
        expect(pushes.length).toBe(2);                                              // the queue is empty now
    });

    it('uses the step length for a stir that carries no time', () => {
        const { driver, pushes } = make();
        driver.queueStirs([stir(40)]);
        driver.run(1000, driver.due(1000 / STEP_HZ, true));
        expect(pushes[0].dt).toBeCloseTo(1 / STEP_HZ, 9);
    });

    it('calls `before` ahead of each step with the step length and its date, the last one being now', () => {
        const { driver } = make();
        const calls: [number, number][] = [];
        const now = 3 * 1000 / STEP_HZ, n = driver.due(now, true);
        driver.run(now, n, (dt, at) => calls.push([dt, at]));
        expect(calls.length).toBe(3);
        expect(calls[2][1]).toBeCloseTo(now, 6);
        expect(calls[0][1]).toBeCloseTo(now - 2 * 1000 / STEP_HZ, 6);
    });

    it('skip drops the queue and the time that passed; clear drops the queue only', () => {
        const { driver, steps, pushes } = make();
        driver.queueStirs([stir(40, 0.004)]);
        driver.skip(5000);
        expect(driver.due(5000, true)).toBe(0);
        driver.run(5000, 1);
        expect(pushes.length).toBe(0);
        expect(steps.length).toBe(1);
        driver.queueStirs([stir(40, 0.004)]);
        driver.clear();
        driver.run(5000, 1);
        expect(pushes.length).toBe(0);
    });

    it('waits one frame with a due step when the frame\'s step budget is spent, then runs it whatever the budget', () => {
        const { driver } = make();
        const budget = new StepBudget(100), frame = 1000 / 120;
        budget.refill();
        budget.spend(1, 100);                                                       // someone else used it all
        expect(driver.due(2 * frame, true, budget)).toBe(0);                        // due, but it waits
        budget.refill();
        budget.spend(1, 100);
        expect(driver.due(3 * frame, true, budget)).toBe(1);                        // waited once: it runs now
        expect(budget.spent).toBe(true);
        budget.refill();
        expect(driver.due(4 * frame, true, budget)).toBe(1);                        // back on its schedule, one frame later
        expect(budget.left).toBe(100 - 64);                                         // an 8 x 8 grid's step spent 64 cells
    });

    it('a grid that has no step due does not wait, whatever the budget', () => {
        const { driver } = make();
        const budget = new StepBudget(0);
        budget.refill();
        expect(driver.due(1000 / 120, true, budget)).toBe(0);
        expect(driver.due(2000 / 120, true, budget)).toBe(0);                       // due now, the budget is spent: waits
        expect(driver.due(3000 / 120, true, budget)).toBe(1);
    });
});
