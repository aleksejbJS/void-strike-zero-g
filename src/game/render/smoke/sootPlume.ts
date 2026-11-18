// One soot plume on screen: a small air grid that the flame's smoke particles feed, the shader quad that draws it (soot
// is its base colour), the solids and the stirs it knows. It has no gameplay circle: smoke only comes from deposits, and
// fades by itself. SootPlumes decides which plumes exist and which step; this class does the work for one. Visual only.

import { AirGrid, type Box, type Stir } from './airGrid';
import { GridDriver } from './gridDriver';
import { SmokeQuad } from './smokeQuad';
import { SolidTracker, type SolidSource } from './solidTracker';
import type { StepBudget } from './stepBudget';
import {
    PLUME_BOX, PLUME_DECAY_PER_S, PLUME_EDGE, PLUME_DENS_PER_S, PLUME_EMIT_AT, PLUME_GONE_PEAK, PLUME_HEAT_PER_S, PLUME_IDLE_S,
    PLUME_REACH_CELLS, PLUME_SOOT_PER_S, SMOKE_SOOT,
} from './smokeTuning';

export class SootPlume {
    readonly grid: AirGrid;
    readonly quad: SmokeQuad;
    readonly box: Box;
    dist2 = 0;                                  // squared distance from the view centre (set by SootPlumes)
    gone = false;                               // destroy() was called
    private readonly driver: GridDriver;
    private readonly solids: SolidTracker;
    private readonly fade = (dt: number): void => this.thin(dt);
    private readonly deposit: Stir;             // the one deposit, moved to each smoke particle in turn
    private readonly born: number;              // ms, when the plume was made: the shader's time counts from here
    private lastDeposit: number;                // ms
    private asleepSince: number | null = null;
    private fresh = true;                       // the grid changed since the quad last uploaded it

    /** The plume's box is PLUME_BOX square, centred on `x`, with `y` PLUME_EMIT_AT of the way down it. */
    constructor(x: number, y: number, n: number, now: number, state: SolidSource | null) {
        this.box = { x: x - PLUME_BOX / 2, y: y - PLUME_BOX * PLUME_EMIT_AT, w: PLUME_BOX, h: PLUME_BOX };
        this.grid = new AirGrid(n, this.box.x, this.box.y, PLUME_BOX);
        this.driver = new GridDriver(this.grid, this.box, now);
        this.solids = new SolidTracker(this.grid, this.box);
        if (state) this.solids.refresh(state);
        this.born = now;
        this.lastDeposit = now;
        this.deposit = {
            x, y, r: PLUME_REACH_CELLS * this.grid.cell, vx: 0, vy: 0, rate: 0,    // rate 0: it adds, it does not push
            heat: PLUME_HEAT_PER_S, soot: PLUME_SOOT_PER_S, dens: PLUME_DENS_PER_S,
        };
        this.quad = new SmokeQuad(this.grid, SMOKE_SOOT);
    }

    /** True when (x, y) is inside the plume's box, not counting the edge strip the shader fades out (soot put there would
     *  pile up unseen against the border and show as a hard cut). */
    contains(x: number, y: number): boolean {
        const { box } = this, edge = PLUME_EDGE * box.w;
        return x >= box.x + edge && x <= box.x + box.w - edge && y >= box.y + edge && y <= box.y + box.h - edge;
    }

    /** One flame smoke particle at (x, y) adds soot, heat and smoke for `dt` seconds (the frame it was seen in). A point
     *  outside the part of the box that holds soot (see contains) puts it at the nearest place inside that part. */
    add(x: number, y: number, dt: number, now: number): void {
        const { box } = this, edge = PLUME_EDGE * box.w;
        this.deposit.x = Math.min(box.x + box.w - edge, Math.max(box.x + edge, x));
        this.deposit.y = Math.min(box.y + box.h - edge, Math.max(box.y + edge, y));
        this.grid.stir(this.deposit, dt);
        this.lastDeposit = now;
        this.fresh = true;
    }

    /** Keep the stirs of this frame that reach the grid; each is applied once, at the next step, for the time it carries. */
    queueStirs(stirs: readonly Stir[]): void {
        this.driver.queueStirs(stirs);
    }

    /** Run the steps due at `now` (ms): `full` is the fast schedule, otherwise half rate; `state` re-reads the solids;
     *  a spent `budget` makes a due step wait a frame (see GridDriver.due). */
    advance(now: number, full: boolean, state: SolidSource, budget?: StepBudget): void {
        const steps = this.driver.due(now, full, budget);
        if (steps === 0) return;
        this.solids.refresh(state);
        this.driver.run(now, steps, this.fade);
        this.fresh = true;
    }

    /** Show the quad, with the grid uploaded if it changed since the last show. */
    show(now: number): void {
        this.quad.mesh.visible = true;
        this.quad.upload((now - this.born) / 1000, 1, this.fresh);      // the plume's age, so the billows never jump with the clock
        this.fresh = false;
    }

    /** Out of view: no stepping, no queue, nothing drawn. */
    sleep(now: number): void {
        this.asleepSince ??= now;
        this.driver.skip(now);
        this.quad.mesh.visible = false;
    }

    wake(): void {
        this.asleepSince = null;
    }

    /** How long (ms) the plume has been out of view, 0 when it is not. */
    asleepFor(now: number): number {
        return this.asleepSince === null ? 0 : now - this.asleepSince;
    }

    /** No deposit for PLUME_IDLE_S and no cell dense enough to be seen. */
    isSpent(now: number): boolean {
        if (now - this.lastDeposit <= PLUME_IDLE_S * 1000) return false;
        const { d } = this.grid;
        for (let k = 0; k < d.length; k++) if (d[k] >= PLUME_GONE_PEAK) return false;
        return true;
    }

    destroy(): void {
        this.gone = true;
        this.driver.clear();
        this.quad.destroy();
    }

    // The smoke fades on its own: the plume has no circle to refill it
    private thin(dt: number): void {
        const keep = Math.exp(-PLUME_DECAY_PER_S * dt), { d } = this.grid;
        for (let k = 0; k < d.length; k++) d[k] *= keep;
    }
}
