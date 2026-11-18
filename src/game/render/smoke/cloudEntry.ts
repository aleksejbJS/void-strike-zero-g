// One smoke cloud on screen: its air grid, the shaper that keeps the grid in the gameplay circle, the shader
// quad that draws it, and (shared with the soot plumes) the driver with its step clock and stir queue and the
// tracker of the solids. CloudField decides who steps and when; this class does the work for one cloud. Visual only.

import type { SmokeCloud } from '../../../types';
import { SMOKE_RADIUS } from '../../systems/smoke';
import { cloudAlpha } from '../effects/smokePuffs';
import { AirGrid, type Box, type Stir } from './airGrid';
import { CloudShaper } from './cloudShape';
import { GridDriver } from './gridDriver';
import { SmokeQuad } from './smokeQuad';
import { SolidTracker, type SolidSource } from './solidTracker';
import { SMOKE_WHITE } from './smokeTuning';

/** The grid box reaches this far past the circle's radius, so the billows and the burst have room. */
export const BOX_REACH = 1.5 * SMOKE_RADIUS;
const FADE_GAIN = 1.2;                         // the spike's look: the quad thins out a little slower than the circle
const RESETTLE_AFTER_MS = 1000;                // out of view this long: fill the cloud as a settled one when it comes back
const EMPTY_MEAN = 0.01;                       // ... or back with less smoke than this per cell (a settled cloud has ~0.2): never filled

export class CloudEntry {
    readonly grid: AirGrid;
    readonly quad: SmokeQuad;
    readonly box: Box;
    /** The sync this entry was last listed in, and its squared distance from the view centre (set by CloudField). */
    stamp = 0;
    dist2 = 0;
    private readonly shaper: CloudShaper;
    private readonly driver: GridDriver;
    private readonly solids: SolidTracker;
    private readonly shape = (dt: number, at: number): void => this.shaper.apply(dt, at);
    private asleepSince: number | null = null;
    private fresh = true;                      // the grid changed since the quad last uploaded it

    /** `state` gives the solids, or null for a cloud with none; a cloud first seen after its burst starts out settled. */
    constructor(readonly cloud: SmokeCloud, n: number, now: number, state: SolidSource | null) {
        const half = BOX_REACH;
        this.box = { x: cloud.pos.x - half, y: cloud.pos.y - half, w: 2 * half, h: 2 * half };
        this.grid = new AirGrid(n, this.box.x, this.box.y, this.box.w);
        this.shaper = new CloudShaper(this.grid, cloud);
        this.driver = new GridDriver(this.grid, this.box, now);
        this.solids = new SolidTracker(this.grid, this.box);
        if (state) this.solids.refresh(state);
        this.shaper.prefill(now);
        this.quad = new SmokeQuad(this.grid, SMOKE_WHITE);
    }

    /** Keep the stirs of this frame that reach the grid; each is applied once, at the next step, for the time it carries. */
    queueStirs(stirs: readonly Stir[]): void {
        this.driver.queueStirs(stirs);
    }

    /** Run the steps due at `now` (ms). `full` is the fast schedule, otherwise half rate; `state` re-reads the solids. */
    advance(now: number, full: boolean, state: SolidSource | null): void {
        const woke = this.wake(now);
        const steps = this.driver.due(now, full);
        if (steps === 0 && !woke) return;
        if (state) this.solids.refresh(state);
        if (woke) this.shaper.prefill(now);
        this.driver.run(now, steps, this.shape);
        this.fresh = true;
    }

    /** Out of view: no stepping, no queue, nothing drawn. */
    sleep(now: number): void {
        this.asleepSince ??= now;
        this.driver.skip(now);
        this.quad.mesh.visible = false;
    }

    /** Show the quad, unless the cloud has faded away, with the grid uploaded if it changed since the last show. */
    show(now: number): void {
        const alpha = cloudAlpha(this.cloud, now);
        this.quad.mesh.visible = alpha > 0;
        if (alpha <= 0) return;
        this.quad.upload((now % 1e6) / 1000, Math.min(1, alpha * FADE_GAIN), this.fresh);
        this.fresh = false;
    }

    destroy(): void {
        this.driver.clear();
        this.quad.destroy();
    }

    // True when the cloud comes back in view with a stale grid: out of view for long, or (born out of view) never filled.
    // The prefill leaves a cloud still in its burst alone, so a young one grows on screen as usual.
    private wake(now: number): boolean {
        const since = this.asleepSince;
        if (since === null) return false;
        this.asleepSince = null;
        return now - since > RESETTLE_AFTER_MS || this.grid.mass() < EMPTY_MEAN * this.grid.d.length;
    }
}
