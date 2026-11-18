// The flamethrower's soot plumes of one game view. Each live smoke particle of the flame engine adds soot, heat and
// smoke to the plume whose box holds it; where none does, a new plume is made (up to PLUME_CAP for the quality, none on
// `low`, where the flame keeps its sprites). A plume is an air grid with no gameplay circle: the heat makes the soot
// rise, the same stirs as the clouds push it, its smoke fades by itself and it is freed once the fire is long out.
// Plumes outside the view and a margin do not step and are hidden. Visual only.

import { Container } from 'pixi.js';
import type { Box, Stir } from './airGrid';
import type { SmokeFrame } from './cloudField';
import type { SootVisitor } from './flameAir';
import { SootPlume } from './sootPlume';
import { safeFrameDt } from './smokeStirs';
import { GRID_N, IMPULSE_DT, PLUME_CAP, PLUME_FULL_RATE, VIEW_MARGIN } from './smokeTuning';

const DROP_AFTER_MS = 1000;                     // out of view this long: freed (it would be stale on its return; soot is short-lived)
const NO_STIRS: readonly Stir[] = [];

/** True when this frame has soot to turn into plumes: the quality allows plumes and the flame has smoke particles alive. */
export const sootWanted = (frame: SmokeFrame | null): boolean =>
    frame !== null && PLUME_CAP[frame.quality] > 0 && frame.flame?.hasSoot() === true;

// A smoke particle leaves less soot as it ages, so the plume fades soon after the fire is out instead of when its last particle dies
const lifeLeft = (age: number, ttl: number): number => (ttl > 0 ? Math.max(0, 1 - age / ttl) : 1);

const apart = (a: Box, b: Box): boolean => a.x > b.x + b.w || b.x > a.x + a.w || a.y > b.y + b.h || b.y > a.y + a.h;
const byDistance = (a: SootPlume, b: SootPlume): number => a.dist2 - b.dist2;

export class SootPlumes {
    readonly layer = new Container();
    private readonly plumes: SootPlume[] = [];
    private readonly awake: SootPlume[] = [];   // the plumes in view this frame, reused
    private readonly reach: Box = { x: 0, y: 0, w: 0, h: 0 };   // the view and its margin, reused
    private destroyed = false;
    // The frame being fed, read by onSoot (one callback for the whole walk: no closure per frame)
    private feedNow = 0;
    private feedDt = 0;
    private feedFrame: SmokeFrame | null = null;
    private readonly onSoot: SootVisitor = (x, y, age, ttl) => this.deposit(x, y, age, ttl);

    /** How many plumes are alive. */
    get count(): number {
        return this.plumes.length;
    }

    /** The air grid of the `i`-th plume (oldest first), for tests. */
    gridAt(i: number): SootPlume['grid'] | undefined {
        return this.plumes[i]?.grid;
    }

    /** Feed, step and draw the plumes at `now` (ms). `stirs` are this frame's stirs, gathered once by the caller (read, not
     *  kept); `dt` is the frame's time in s, which the deposits last, so the soot per second does not depend on the frame rate.
     *  Without a `frame` (a preview) or on a quality with no plumes, none is kept. */
    sync(now: number, frame: SmokeFrame | null, stirs: readonly Stir[] = NO_STIRS, dt: number = IMPULSE_DT): void {
        if (this.destroyed) return;
        if (!frame || PLUME_CAP[frame.quality] === 0) {
            if (this.plumes.length > 0) this.dropAll();
            return;
        }
        this.watchView(now, frame.view);
        if (frame.flame?.hasSoot()) this.feed(now, frame, safeFrameDt(dt));
        this.stepAndShow(now, frame, stirs);
    }

    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.dropAll();
        this.layer.parent?.removeChild(this.layer);
        this.layer.destroy();
    }

    // Plumes in the view (plus margin) are awake; the rest sleep, and are freed after a while
    private watchView(now: number, view: Box): void {
        const { reach, awake, plumes } = this;
        reach.x = view.x - VIEW_MARGIN; reach.y = view.y - VIEW_MARGIN;
        reach.w = view.w + 2 * VIEW_MARGIN; reach.h = view.h + 2 * VIEW_MARGIN;
        awake.length = 0;
        let kept = 0;
        for (const plume of plumes) {
            if (apart(plume.box, reach)) {
                plume.sleep(now);
                if (plume.asleepFor(now) > DROP_AFTER_MS) { plume.destroy(); continue; }
            } else {
                plume.wake();
                awake.push(plume);
            }
            plumes[kept++] = plume;
        }
        plumes.length = kept;
    }

    // Every smoke particle in reach adds to the plume that holds it, or makes one. A particle out of reach adds nothing: no
    // plume with a particle in reach sleeps (its box overlaps the reach), so no sleeping plume misses a deposit.
    private feed(now: number, frame: SmokeFrame, dt: number): void {
        this.feedNow = now;
        this.feedDt = dt;
        this.feedFrame = frame;
        frame.flame!.forEachSoot(this.onSoot);
        this.feedFrame = null;
    }

    private deposit(x: number, y: number, age: number, ttl: number): void {
        const { reach, feedFrame: frame } = this;
        if (!frame || x < reach.x || x > reach.x + reach.w || y < reach.y || y > reach.y + reach.h) return;
        const plume = this.holding(x, y) ?? this.make(x, y, this.feedNow, frame);
        plume?.add(x, y, this.feedDt * lifeLeft(age, ttl), this.feedNow);
    }

    private holding(x: number, y: number): SootPlume | undefined {
        for (const plume of this.plumes) if (plume.contains(x, y)) return plume;
        return undefined;
    }

    private make(x: number, y: number, now: number, frame: SmokeFrame): SootPlume | null {
        if (this.plumes.length >= PLUME_CAP[frame.quality]) return null;
        const plume = new SootPlume(x, y, Math.ceil(GRID_N[frame.quality] / 2), now, frame.state);
        this.plumes.push(plume);
        this.awake.push(plume);
        this.layer.addChild(plume.quad.mesh);
        return plume;
    }

    // The plumes nearest the view centre step every frame, the others at half rate; a plume with nothing left is freed
    private stepAndShow(now: number, frame: SmokeFrame, stirs: readonly Stir[]): void {
        const { awake } = this, { view } = frame;
        const cx = view.x + view.w / 2, cy = view.y + view.h / 2;
        for (const plume of awake) plume.dist2 = (plume.box.x + plume.box.w / 2 - cx) ** 2 + (plume.box.y + plume.box.h / 2 - cy) ** 2;
        awake.sort(byDistance);
        let spent = false;
        for (let i = 0; i < awake.length; i++) {
            const plume = awake[i];
            plume.queueStirs(stirs);
            plume.advance(now, i < PLUME_FULL_RATE, frame.state);
            plume.show(now);
            if (plume.isSpent(now)) { plume.destroy(); spent = true; }
        }
        if (spent) this.reap();
    }

    // Forget the plumes that were freed
    private reap(): void {
        const { plumes } = this;
        let kept = 0;
        for (const plume of plumes) if (!plume.gone) plumes[kept++] = plume;
        plumes.length = kept;
    }

    private dropAll(): void {
        for (const plume of this.plumes) plume.destroy();
        this.plumes.length = 0;
        this.awake.length = 0;
    }
}
