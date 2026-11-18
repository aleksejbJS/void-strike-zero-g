// CloudShaper turns an AirGrid into a grenade cloud. The gameplay cloud is a circle (smokeRadiusAt) and
// the picture follows it like a soft jar: a burst of air pushes outward at birth, the density refills
// toward a dense middle inside an uneven, slowly turning outline, it fades outside the live radius, and
// a few seeded stirs keep the air moving. Call apply() once before each grid.step(); it only edits the
// density and the air velocity. Everything random comes from seededRandom(cloud.id). Visual only.

import { SmokeCloud } from '../../../types';
import { smokeRadiusAt } from '../../systems/smoke';
import { AirGrid, Stir } from './airGrid';
import { seededRandom } from './seededRandom';
import {
    BURST_DECAY_PER_S, BURST_GAIN, BURST_MIN_SPEED, BURST_SPEED, CHURN_REACH_CELLS, CHURN_RATE, CHURN_RISE_BIAS,
    CHURN_SPEED, CHURN_STIRS, FADE_OUTSIDE_PER_S, FAST_REFILL_S, GROW_PER_S, OUTLINE_WAVES, REFILL_FAST_PER_S,
    REFILL_SLOW_PER_S, TARGET_PEAK,
} from './smokeTuning';

const TAU = 2 * Math.PI;
const MIN_REACH = 1;                       // px: a cloud smaller than this is only fading, nothing refills

export class CloudShaper {
    // Per cell, computed once from the cell's place relative to the cloud centre
    private readonly dist: Float32Array;                   // distance from the centre, px
    private readonly dirX: Float32Array;                   // unit vector away from the centre (0 within 1 px of it)
    private readonly dirY: Float32Array;
    private readonly waveSin: Float32Array[];              // sin(waves * angle), one array per outline wave
    private readonly waveCos: Float32Array[];
    private readonly phase: number[];                      // start angle of each outline wave, from the cloud id
    private readonly outline: Float32Array;                // outline factor of each cell at the current age (about 0.7..1.3)
    private readonly rng: () => number;
    private readonly churnStir: Stir;                      // reused: no object per stir

    constructor(private readonly grid: AirGrid, private readonly cloud: SmokeCloud) {
        const { n, cell, x0, y0 } = grid, cells = n * n;
        this.rng = seededRandom(cloud.id);
        this.phase = OUTLINE_WAVES.map(() => this.rng() * TAU);
        this.dist = new Float32Array(cells); this.dirX = new Float32Array(cells); this.dirY = new Float32Array(cells);
        this.outline = new Float32Array(cells);
        this.waveSin = OUTLINE_WAVES.map(() => new Float32Array(cells));
        this.waveCos = OUTLINE_WAVES.map(() => new Float32Array(cells));
        for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
            const k = i + j * n, dx = x0 + (i + 0.5) * cell - cloud.pos.x, dy = y0 + (j + 0.5) * cell - cloud.pos.y;
            const dist = Math.hypot(dx, dy), angle = Math.atan2(dy, dx);
            this.dist[k] = dist;
            if (dist > 1) { this.dirX[k] = dx / dist; this.dirY[k] = dy / dist; }
            OUTLINE_WAVES.forEach((w, m) => { this.waveSin[m][k] = Math.sin(w.waves * angle); this.waveCos[m][k] = Math.cos(w.waves * angle); });
        }
        this.churnStir = { x: 0, y: 0, r: cell * CHURN_REACH_CELLS, vx: 0, vy: 0, rate: CHURN_RATE };
    }

    /** A cloud first seen after its burst (older than FAST_REFILL_S) starts as a settled one; a young cloud is left to grow. */
    prefill(now: number): void {
        const age = this.ageAt(now);
        if (age < FAST_REFILL_S) return;
        const reach = smokeRadiusAt(this.cloud, now);       // settled: fully grown to the live radius
        const { grid: { n, d, solid }, dist, outline } = this;
        this.shapeOutline(age);
        for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
            const k = i + j * n;
            if (solid[k]) continue;
            const edge = reach * outline[k], q = dist[k] / edge;
            d[k] = reach > MIN_REACH && q < 1 ? TARGET_PEAK * (1 - q * q) : 0;
        }
    }

    /** Burst, refill, fade and churn for a step of `dt` s at time `now` (ms), to run just before grid.step(dt). */
    apply(dt: number, now: number): void {
        if (!(dt > 0)) return;
        const age = this.ageAt(now);
        const grow = smokeRadiusAt(this.cloud, now) * (1 - Math.exp(-age * GROW_PER_S));
        const refill = 1 - Math.exp(-(age < FAST_REFILL_S ? REFILL_FAST_PER_S : REFILL_SLOW_PER_S) * dt);
        const fade = Math.exp(-FADE_OUTSIDE_PER_S * dt);
        const burst = BURST_SPEED * Math.exp(-age * BURST_DECAY_PER_S);
        const push = burst > BURST_MIN_SPEED ? burst * BURST_GAIN * dt : 0;     // px/s gained along the outward direction
        this.shapeOutline(age);
        const { grid: { n, d, u, v, solid }, dist, dirX, dirY, outline } = this;
        const growing = grow > MIN_REACH;
        for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
            const k = i + j * n;
            if (solid[k]) continue;
            const edge = grow * outline[k], q = dist[k] / edge;
            if (growing && q < 1) {
                const target = TARGET_PEAK * (1 - q * q);
                if (d[k] < target) d[k] += (target - d[k]) * refill;
                u[k] += dirX[k] * push;
                v[k] += dirY[k] * push;
            } else d[k] *= fade;
        }
        this.churn(dt, grow);
    }

    private ageAt(now: number): number {
        return Math.max(0, now - this.cloud.bornAt) / 1000;
    }

    // outline[k] = 1 + the sum over waves of amp * sin(waves * angle + phase + drift * age), from precomputed sin/cos
    private shapeOutline(age: number): void {
        const { outline } = this;
        outline.fill(1);
        OUTLINE_WAVES.forEach((w, m) => {
            const a = this.phase[m] + w.drift * age, withSin = w.amp * Math.cos(a), withCos = w.amp * Math.sin(a);
            const ws = this.waveSin[m], wc = this.waveCos[m];
            for (let k = 0; k < outline.length; k++) outline[k] += withSin * ws[k] + withCos * wc[k];
        });
    }

    // A few random stirs inside the cloud, drifting a little upward, so it never sits still
    private churn(dt: number, grow: number): void {
        const { grid, cloud, rng, churnStir: st } = this;
        for (let m = 0; m < CHURN_STIRS; m++) {
            const angle = rng() * TAU, spread = grow * rng();
            st.x = cloud.pos.x + Math.cos(angle) * spread;
            st.y = cloud.pos.y + Math.sin(angle) * spread;
            st.vx = (rng() - 0.5) * 2 * CHURN_SPEED;
            st.vy = (rng() - 0.5 - CHURN_RISE_BIAS) * 2 * CHURN_SPEED;     // y points down: the bias makes it negative, upward
            grid.stir(st, dt);
        }
    }
}
