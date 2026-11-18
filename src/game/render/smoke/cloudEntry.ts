// One smoke cloud on screen: its air grid, the shaper that keeps the grid in the gameplay circle, the shader
// quad that draws it, the solids it knows, the stirs waiting for its next step and its step clock.
// CloudField decides who steps and when; this class does the work for one cloud. Visual only.

import type { GameState, SmokeCloud } from '../../../types';
import { SMOKE_RADIUS } from '../../systems/smoke';
import { isKnownCoverKind, type Cover } from '../../cover/coverTypes';
import { coverRect, isIntact } from '../../cover/coverGeometry';
import { cloudFade } from '../effects/smokePuffs';
import { AirGrid, type Box, type Stir } from './airGrid';
import { CloudShaper } from './cloudShape';
import { SmokeQuad } from './smokeQuad';
import { StepClock } from './stepClock';
import { SMOKE_WHITE } from './smokeTuning';

/** The grid box reaches this far past the circle's radius, so the billows and the burst have room. */
export const BOX_REACH = 1.5 * SMOKE_RADIUS;
const FADE_GAIN = 1.2;                         // the spike's look: the quad thins out a little slower than the circle
const RESETTLE_AFTER_MS = 1000;                // out of view this long: fill the cloud as a settled one when it comes back

/** What the solids are made from: the platforms (fixed for the match) and the cover that can break. */
export type SolidSource = Pick<GameState, 'platforms' | 'cover'>;

const overlaps = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export class CloudEntry {
    readonly grid: AirGrid;
    readonly quad: SmokeQuad;
    readonly box: Box;
    /** The sync this entry was last listed in, and its squared distance from the view centre (set by CloudField). */
    stamp = 0;
    dist2 = 0;
    private readonly shaper: CloudShaper;
    private readonly clock: StepClock;
    private readonly queue: Stir[] = [];
    private platformBoxes: Box[] | null = null;
    private coverKey: string | null = null;    // ids of the intact cover in the box when the solids were last marked
    private asleepSince: number | null = null;

    /** `state` gives the solids, or null for a cloud with none; a cloud first seen after its burst starts out settled. */
    constructor(readonly cloud: SmokeCloud, n: number, now: number, state: SolidSource | null) {
        const half = BOX_REACH;
        this.box = { x: cloud.pos.x - half, y: cloud.pos.y - half, w: 2 * half, h: 2 * half };
        this.grid = new AirGrid(n, this.box.x, this.box.y, this.box.w);
        this.shaper = new CloudShaper(this.grid, cloud);
        this.clock = new StepClock(now);
        if (state) this.refreshSolids(state);
        this.shaper.prefill(now);
        this.quad = new SmokeQuad(this.grid, SMOKE_WHITE);
    }

    /** Keep the stirs of this frame that reach the grid; each is applied once, at the next step, for the time it carries. */
    queueStirs(stirs: readonly Stir[]): void {
        const { x, y, w, h } = this.box;
        for (const st of stirs) {
            if (st.x + st.r < x || st.x - st.r > x + w || st.y + st.r < y || st.y - st.r > y + h) continue;
            this.queue.push(st);
        }
    }

    /** Run the steps due at `now` (ms). `full` is the fast schedule, otherwise half rate; `state` re-reads the solids. */
    advance(now: number, full: boolean, state: SolidSource | null): void {
        const woke = this.wake(now);
        const steps = this.clock.tick(now, full);
        if (steps === 0 && !woke) return;
        if (state) this.refreshSolids(state);
        if (woke) this.shaper.prefill(now);
        const { dt } = this.clock;
        for (let k = 0; k < steps; k++) {
            // Catch-up steps are dated back from `now`, so the last one is always the present
            const at = now - (steps - 1 - k) * dt * 1000;
            if (k === 0) this.applyQueue(dt);
            this.shaper.apply(dt, at);
            this.grid.step(dt);
        }
    }

    /** Out of view: no stepping, no queue, nothing drawn. */
    sleep(now: number): void {
        this.asleepSince ??= now;
        this.queue.length = 0;
        this.clock.skip(now);
        this.quad.mesh.visible = false;
    }

    /** Upload the grid and show the quad, unless the cloud has faded away. */
    show(now: number): void {
        const { alpha } = cloudFade(this.cloud, now);
        this.quad.mesh.visible = alpha > 0;
        if (alpha > 0) this.quad.upload((now % 1e6) / 1000, Math.min(1, alpha * FADE_GAIN));
    }

    destroy(): void {
        this.queue.length = 0;
        this.quad.destroy();
    }

    // True when the cloud was out of view for long enough that its grid is stale
    private wake(now: number): boolean {
        const since = this.asleepSince;
        if (since === null) return false;
        this.asleepSince = null;
        return now - since > RESETTLE_AFTER_MS;
    }

    // A stir acts for the time it carries (the frame it came from), not for the step: a cloud that steps every second
    // frame or every fourth gets the same push per second of play as one that steps every frame. `dt` is only for a stir with none.
    private applyQueue(dt: number): void {
        for (const st of this.queue) this.grid.stir(st, st.dt ?? dt);
        this.queue.length = 0;
    }

    // Platforms never change in a match; cover can break and come back, so the solids follow the intact pieces in the box
    private refreshSolids(state: SolidSource): void {
        const key = this.intactCoverKey(state);
        if (key === this.coverKey) return;
        this.coverKey = key;
        this.platformBoxes ??= state.platforms.filter(p => overlaps(this.box, p));
        const boxes = [...this.platformBoxes];
        for (const c of state.cover ?? []) if (this.isSolidCover(c)) boxes.push(coverRect(c));
        this.grid.markSolids(boxes);
    }

    private intactCoverKey(state: SolidSource): string {
        let key = '';
        for (const c of state.cover ?? []) if (this.isSolidCover(c)) key += `${c.id},`;
        return key;
    }

    // A kind this build has no spec for cannot be sized: it is left out, as the cover views leave it out
    private isSolidCover(c: Cover): boolean {
        return isIntact(c) && isKnownCoverKind(c.kind) && overlaps(this.box, coverRect(c));
    }
}
