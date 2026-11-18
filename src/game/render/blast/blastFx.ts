// Explosions and rocket trails of one game view, drawn from what is on screen, so offline, host and guest look alike.
// - A fresh blast (its 'ring' particle, the first frame it is seen) makes a flash of warm light, a fireball of
//   additive flame puffs, and its smoke: an air grid drawn by the smoke shader (BlastCloud) when `grids` allows it
//   and a grid slot is free (a grid out of view gives its slot up), otherwise a few simple dark smoke puffs.
// - A rocket in flight glows at its nozzle and leaves a ribbon of soft smoke puffs from its tail.
// - Debris flung by a blast trails thin dark smoke while it still flies fast.
// Trails are made only in the view (plus a margin); blast grids out of it do not step and are hidden. Looks only.

import { Container } from 'pixi.js';
import { WeaponType } from '../../../types';
import type { Box, Stir } from '../smoke/airGrid';
import type { SmokeFrame } from '../smoke/cloudField';
import type { StepBudget } from '../smoke/stepBudget';
import { GRID_N, VIEW_MARGIN } from '../smoke/smokeTuning';
import { flameTextures } from '../flame/flameTextures';
import { BlastCloud } from './blastCloud';
import { blastScale, debrisPuff, fireballPuffs, flashPuff, simpleSmokePuffs, trailPuff } from './blastLooks';
import { NozzleGlows } from './nozzleGlows';
import { PuffSprites, type PuffSpec } from './puffSprites';
import { TrailWalker } from './trailWalker';
import {
    BLAST_GRID_SHARE, DEBRIS_STEP, DEBRIS_UNTIL_LIFE, FIRE_CAP, FLASH_CAP, MAX_BLAST_GRIDS, RING_SIZE, ROCKET_TAIL,
    SMOKE_CAP, TRAIL_STEP,
} from './blastTuning';

const MAX_DT = 0.1;                                 // s: a longer gap (a hitch, a hidden tab) moves the puffs this much

const apart = (a: Box, b: Box): boolean => a.x > b.x + b.w || b.x > a.x + a.w || a.y > b.y + b.h || b.y > a.y + a.h;
const inside = (b: Box, x: number, y: number): boolean => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

export class BlastFx {
    /** Bottom to top: trail and simple smoke, blast grids, fireball, nozzle glows, flash. */
    readonly layer = new Container();
    private readonly smoke: PuffSprites;
    private readonly fire: PuffSprites;
    private readonly flash: PuffSprites;
    private readonly nozzles: NozzleGlows;
    private readonly gridLayer = new Container();
    private readonly clouds: BlastCloud[] = [];
    private readonly walker = new TrailWalker();
    private readonly reach: Box = { x: 0, y: 0, w: 0, h: 0 };   // the view and its margin this frame
    private seen = new Set<string>();               // ring ids of the previous frame
    private next = new Set<string>();
    private last = Number.NaN;
    private destroyed = false;

    constructor() {
        const tex = flameTextures();
        this.smoke = new PuffSprites(tex.smoke, false, SMOKE_CAP);
        this.fire = new PuffSprites(tex.flame, true, FIRE_CAP);
        this.flash = new PuffSprites(tex.glow, true, FLASH_CAP);
        this.nozzles = new NozzleGlows(tex.flame);
        this.layer.addChild(this.smoke.layer, this.gridLayer, this.fire.layer, this.nozzles.layer, this.flash.layer);
    }

    /** How many blast grids are alive. */
    get grids(): number {
        return this.clouds.length;
    }

    /** Draw the frame at `now` (ms). `stirs` are this frame's stirs (read, not kept); `grids` false: no blast grids at
     *  all (`low` quality, no shader): the live ones are freed and blast smoke is simple puffs. */
    sync(now: number, frame: SmokeFrame, stirs: readonly Stir[], grids: boolean, budget?: StepBudget): void {
        if (this.destroyed) return;
        const dt = Number.isFinite(this.last) && now >= this.last ? Math.min(MAX_DT, (now - this.last) / 1000) : 0;
        this.last = now;
        if (!grids && this.clouds.length > 0) this.dropGrids();
        this.watchView(frame.view);
        this.watchBlasts(now, frame, grids);
        this.trails(frame);
        this.runGrids(now, frame, stirs, budget);
        this.smoke.update(dt);
        this.fire.update(dt);
        this.flash.update(dt);
    }

    /** Free the blast grids (their smoke is gone at once); the puffs go on. */
    dropGrids(): void {
        for (const c of this.clouds) c.destroy();
        this.clouds.length = 0;
    }

    /** Free everything; the view is not usable afterwards. Safe to call twice. */
    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.dropGrids();
        this.walker.clear();
        this.smoke.destroy();
        this.fire.destroy();
        this.flash.destroy();
        this.nozzles.destroy();
        this.layer.parent?.removeChild(this.layer);
        this.layer.destroy({ children: true });
    }

    private watchView(view: Box): void {
        const { reach } = this;
        reach.x = view.x - VIEW_MARGIN; reach.y = view.y - VIEW_MARGIN;
        reach.w = view.w + 2 * VIEW_MARGIN; reach.h = view.h + 2 * VIEW_MARGIN;
    }

    // A ring seen for the first time is a fresh blast. The rings of this frame are remembered even when drawing one
    // throws, so no blast is drawn twice.
    private watchBlasts(now: number, frame: SmokeFrame, grids: boolean): void {
        const { next } = this;
        try {
            for (const p of frame.state.particles) {
                if (p.type !== 'ring') continue;
                next.add(p.id);
                if (!this.seen.has(p.id)) this.blast(p.pos.x, p.pos.y, blastScale(p.size / RING_SIZE), now, frame, grids);
            }
        } finally {
            for (const p of frame.state.particles) if (p.type === 'ring') next.add(p.id);
            const old = this.seen;
            this.seen = next;
            old.clear();
            this.next = old;
        }
    }

    private blast(x: number, y: number, k: number, now: number, frame: SmokeFrame, grids: boolean): void {
        this.flash.add(flashPuff(x, y, k));
        this.addAll(this.fire, fireballPuffs(x, y, k));
        if (!grids || !this.freeSlot(x, y)) {
            this.addAll(this.smoke, simpleSmokePuffs(x, y, k));
            return;
        }
        const cloud = new BlastCloud(x, y, k, Math.round(GRID_N[frame.quality] * BLAST_GRID_SHARE), now, frame.state);
        this.clouds.push(cloud);
        this.gridLayer.addChild(cloud.quad.mesh);
    }

    // True when a grid may be made: under the cap, or a grid out of view gives way to a blast in view
    private freeSlot(x: number, y: number): boolean {
        if (this.clouds.length < MAX_BLAST_GRIDS) return true;
        if (!inside(this.reach, x, y)) return false;
        const i = this.clouds.findIndex((c) => c.asleep);
        if (i < 0) return false;
        this.clouds[i].destroy();
        this.clouds.splice(i, 1);
        return true;
    }

    private addAll(pool: PuffSprites, specs: readonly PuffSpec[]): void {
        for (const spec of specs) pool.add(spec);
    }

    // Puffs along the path each rocket and each flying chunk in view made since the last frame
    private trails(frame: SmokeFrame): void {
        const { reach, walker, nozzles } = this;
        nozzles.begin();
        for (const proj of frame.state.projectiles) {
            if (proj.type !== WeaponType.ROCKET_LAUNCHER || !inside(reach, proj.pos.x, proj.pos.y)) continue;
            const speed = Math.hypot(proj.vel.x, proj.vel.y) || 1;      // a rocket at rest has no heading: smoke on it
            const tx = proj.pos.x - (proj.vel.x / speed) * ROCKET_TAIL, ty = proj.pos.y - (proj.vel.y / speed) * ROCKET_TAIL;
            nozzles.place(tx, ty);
            walker.walk(proj.id, tx, ty, TRAIL_STEP, this.onTrail);
        }
        for (const p of frame.state.particles) {
            if (p.type !== 'debris' || p.life < DEBRIS_UNTIL_LIFE || !inside(reach, p.pos.x, p.pos.y)) continue;
            walker.walk(p.id, p.pos.x, p.pos.y, DEBRIS_STEP, this.onDebris);
        }
        nozzles.end();
        walker.endFrame();
    }

    private readonly onTrail = (x: number, y: number): void => this.smoke.add(trailPuff(x, y));
    private readonly onDebris = (x: number, y: number): void => this.smoke.add(debrisPuff(x, y));

    // Step and show the grids in view; free the spent ones
    private runGrids(now: number, frame: SmokeFrame, stirs: readonly Stir[], budget?: StepBudget): void {
        if (this.clouds.length === 0) return;
        let kept = 0;
        for (const cloud of this.clouds) {
            if (apart(cloud.box, this.reach)) cloud.sleep(now);
            else {
                cloud.queueStirs(stirs);
                cloud.advance(now, frame.state, budget);
                cloud.show(now);
            }
            if (cloud.isSpent(now)) cloud.destroy();
            else this.clouds[kept++] = cloud;
        }
        this.clouds.length = kept;
    }
}
