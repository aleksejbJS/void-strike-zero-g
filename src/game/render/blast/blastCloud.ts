// The smoke of one explosion as a short-lived air grid, drawn by the smoke shader. The fireball pours hot, sooty
// smoke into a lumpy ball that swells for a moment; random swirls roll it, the heat glows orange and lifts it, and it
// thins out on its own within about two seconds. The world's stirs (shots, other blasts, the flame) push it like any
// smoke. No gameplay meaning. Visual only.

import { AirGrid, type Box, type Stir } from '../smoke/airGrid';
import { GridDriver } from '../smoke/gridDriver';
import { SmokeQuad } from '../smoke/smokeQuad';
import { SolidTracker, type SolidSource } from '../smoke/solidTracker';
import type { StepBudget } from '../smoke/stepBudget';
import {
    BLAST_BELOW, BLAST_BOX, BLAST_CORE, BLAST_FADE_S, BLAST_GONE_PEAK, BLAST_LIFE_S, BLAST_MIN_S, BLAST_SMOKE, POUR_DENS_PER_S,
    POUR_HEAT_PER_S, POUR_S, POUR_SOOT_PER_S, SWIRL_RATE, SWIRL_S, SWIRL_SPEED, SWIRLS, THIN_END_PER_S, THIN_RAMP_S,
    THIN_START_PER_S,
} from './blastTuning';

const DENS_CAP = 1.45;                  // just under the texture's range (FIELD_RANGE 1.5)
const HEAT_CAP = 1.5;
const LUMPS = 4;

/** How much of the smoke shows at `age` s: all of it, then fading to none over the last BLAST_FADE_S of its life. */
export const blastFade = (age: number): number => Math.min(1, Math.max(0, (BLAST_LIFE_S - age) / BLAST_FADE_S));

export class BlastCloud {
    readonly grid: AirGrid;
    readonly quad: SmokeQuad;
    readonly box: Box;
    gone = false;
    asleep = false;                     // out of view on the last frame
    private readonly driver: GridDriver;
    private readonly solids: SolidTracker;
    private readonly born: number;      // ms; the shader's time counts from here
    private readonly lumps: { phase: number; waves: number; amp: number }[] = [];
    private readonly swirl: Stir = { x: 0, y: 0, r: 0, vx: 0, vy: 0, rate: SWIRL_RATE };
    private readonly before = (dt: number, at: number): void => this.shape(dt, (at - this.born) / 1000);

    /** A blast of scale `k` (already clamped) at (x, y), on an `n`-cell grid, born at `now` (ms). */
    constructor(private readonly x: number, private readonly y: number, private readonly k: number, n: number, now: number, state: SolidSource) {
        const size = BLAST_BOX * k;
        this.box = { x: x - size / 2, y: y - size * BLAST_BELOW, w: size, h: size };
        this.grid = new AirGrid(n, this.box.x, this.box.y, size);
        this.driver = new GridDriver(this.grid, this.box, now);
        this.solids = new SolidTracker(this.grid, this.box);
        this.solids.refresh(state);
        this.born = now;
        for (let i = 0; i < LUMPS; i++) {
            this.lumps.push({ phase: Math.random() * 2 * Math.PI, waves: 2 + Math.floor(Math.random() * 5), amp: 0.1 + Math.random() * 0.12 });
        }
        this.shape(1 / 30, 0);                                    // something to see on the very first frame
        this.quad = new SmokeQuad(this.grid, BLAST_SMOKE);
    }

    queueStirs(stirs: readonly Stir[]): void {
        this.driver.queueStirs(stirs);
    }

    /** Run the steps due at `now` (ms); `state` re-reads the solids; a spent `budget` makes a due step wait a frame. */
    advance(now: number, state: SolidSource, budget?: StepBudget): void {
        const steps = this.driver.due(now, true, budget);
        if (steps === 0) return;
        this.solids.refresh(state);
        this.driver.run(now, steps, this.before);
    }

    /** Out of view: time passes with no steps, nothing drawn. */
    sleep(now: number): void {
        this.asleep = true;
        this.driver.skip(now);
        this.quad.mesh.visible = false;
    }

    show(now: number): void {
        this.asleep = false;
        this.quad.mesh.visible = true;
        const age = (now - this.born) / 1000;
        this.quad.upload(age, blastFade(age), true);
    }

    /** Old enough to free: past BLAST_LIFE_S, or past BLAST_MIN_S with no cell dense enough to be seen. */
    isSpent(now: number): boolean {
        const age = (now - this.born) / 1000;
        if (age > BLAST_LIFE_S) return true;
        if (age < BLAST_MIN_S) return false;
        const { d } = this.grid;
        for (let i = 0; i < d.length; i++) if (d[i] >= BLAST_GONE_PEAK) return false;
        return true;
    }

    destroy(): void {
        if (this.gone) return;
        this.gone = true;
        this.driver.clear();
        this.quad.destroy();
    }

    // Before each step: the smoke thins (faster as it ages), the fireball pours, the young smoke is swirled
    private shape(dt: number, age: number): void {
        const { d } = this.grid;
        const rate = THIN_START_PER_S + (THIN_END_PER_S - THIN_START_PER_S) * Math.min(1, age / THIN_RAMP_S);
        const keep = Math.exp(-rate * dt);
        for (let i = 0; i < d.length; i++) d[i] *= keep;
        if (age < POUR_S) this.pour(dt, age);
        if (age < SWIRL_S) this.stirUp(dt, 1 - age / SWIRL_S);
    }

    // Smoke, heat and soot into a lumpy ball that swells from half to full size; the pour weakens as it goes
    private pour(dt: number, age: number): void {
        const { n, cell, x0, y0, d, t, s, solid } = this.grid;
        const p = age / POUR_S, r0 = BLAST_CORE * this.k * (0.5 + 0.5 * Math.sqrt(p)), w = (1 - p * 0.6) * dt;
        for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
            const kk = i + j * n;
            if (solid[kk]) continue;
            const dx = x0 + (i + 0.5) * cell - this.x, dy = y0 + (j + 0.5) * cell - this.y;
            const angle = Math.atan2(dy, dx);
            let edge = r0;
            for (const l of this.lumps) edge += r0 * l.amp * Math.sin(l.waves * angle + l.phase + age * 2);
            const q = Math.hypot(dx, dy) / edge;
            if (q >= 1) continue;
            const f = (1 - q * q) * w;
            d[kk] = Math.min(DENS_CAP, d[kk] + POUR_DENS_PER_S * f);
            t[kk] = Math.min(HEAT_CAP, t[kk] + POUR_HEAT_PER_S * f);
            s[kk] = Math.min(1, s[kk] + POUR_SOOT_PER_S * f);
        }
    }

    // Random swirls inside the young smoke, so it rolls instead of rising as one block
    private stirUp(dt: number, strength: number): void {
        const { swirl, k } = this, reach = BLAST_CORE * k;
        for (let i = 0; i < SWIRLS; i++) {
            const a = Math.random() * 2 * Math.PI, r = Math.random() * reach;
            swirl.x = this.x + Math.cos(a) * r;
            swirl.y = this.y - Math.random() * reach * 0.8 + Math.sin(a) * r * 0.5;
            swirl.r = (14 + Math.random() * 14) * k;
            swirl.vx = (Math.random() * 2 - 1) * SWIRL_SPEED * strength;
            swirl.vy = (Math.random() * 2 - 1.2) * SWIRL_SPEED * strength;
            this.grid.stir(swirl, dt);
        }
    }
}
