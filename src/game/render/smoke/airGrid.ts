// A small 2D air grid for one smoke cloud: stable fluids (vorticity confinement, pressure projection,
// semi-Lagrangian advection) on a square of n x n cells. Fields per cell: air velocity (u, v in px/s),
// smoke density d, heat t and soot s. Solid cells (platforms, intact cover) stop the air; the box edge is
// open, so smoke leaves the grid and the outermost ring of cells is always empty.
// Pure typed-array code with no Pixi and no shaping: CloudShaper decides where smoke belongs, the
// stirs push it. Pixi's y points down, so "rises" means y decreases. Visual only.

import { AirSolver } from './airSolver';
import { BUOYANCY, COOL_PER_S, DAMP_PER_S, HEAT_MAX, MAX_STIR_SPEED, SOOT_MAX } from './smokeTuning';

export type Box = { x: number; y: number; w: number; h: number };

/** A push on the air around (x, y). Everything falls off linearly from the centre to the reach `r`.
 *  `rate` is how fast the air follows (vx, vy); `heat`, `soot` and `carve` are amounts per second at the
 *  centre and do not depend on `rate`. */
export type Stir = {
    x: number; y: number; r: number;      // world centre and reach, px
    vx: number; vy: number;               // air velocity it drives, px/s (radial: the outward speed is vx)
    radial?: boolean;
    rate: number;                         // how fast the air follows that velocity, 1/s (0: no push)
    heat?: number; soot?: number;         // added to the cell, capped at HEAT_MAX / SOOT_MAX
    carve?: number;                       // share of the density removed
};

// An optional amount (heat, soot, carve) may be left out, but if it is there it must be a finite number >= 0
const isAmount = (a: number | undefined): boolean => a === undefined || (Number.isFinite(a) && a >= 0);

/** A stir with a non-finite number or a negative reach, rate or amount would write NaN into the air: skip it. */
const isUsable = (st: Stir): boolean =>
    Number.isFinite(st.x) && Number.isFinite(st.y) && Number.isFinite(st.vx) && Number.isFinite(st.vy)
    && Number.isFinite(st.r) && st.r > 0 && Number.isFinite(st.rate) && st.rate >= 0
    && isAmount(st.heat) && isAmount(st.soot) && isAmount(st.carve);

export class AirGrid {
    readonly cell: number;
    readonly d: Float32Array;
    readonly t: Float32Array;
    readonly s: Float32Array;
    readonly u: Float32Array;
    readonly v: Float32Array;
    readonly solid: Uint8Array;
    private solidIdx = new Int32Array(0);       // indices of the solid cells, to empty them without scanning
    private readonly solver: AirSolver;
    private readonly scratch: [Float32Array, Float32Array, Float32Array];

    constructor(readonly n: number, readonly x0: number, readonly y0: number, readonly size: number) {
        if (!Number.isInteger(n) || n < 4) throw new RangeError(`AirGrid needs an integer n >= 4, got ${n}`);
        if (!(size > 0)) throw new RangeError(`AirGrid needs a positive size, got ${size}`);
        const cells = n * n;
        this.cell = size / n;
        const make = () => new Float32Array(cells);
        this.d = make(); this.t = make(); this.s = make(); this.u = make(); this.v = make();
        this.scratch = [make(), make(), make()];
        this.solid = new Uint8Array(cells);
        this.solver = new AirSolver(n, this.cell, this.u, this.v, this.solid);
    }

    /** Replace the solid cells with those whose centre lies inside any of `boxes`; they are emptied. */
    markSolids(boxes: readonly Box[]): void {
        const { n, cell, x0, y0, solid } = this;
        solid.fill(0);
        for (const b of boxes) {
            // Cell i has its centre at x0 + (i + 0.5) * cell
            const i0 = Math.max(0, Math.ceil((b.x - x0) / cell - 0.5)), i1 = Math.min(n - 1, Math.floor((b.x + b.w - x0) / cell - 0.5));
            const j0 = Math.max(0, Math.ceil((b.y - y0) / cell - 0.5)), j1 = Math.min(n - 1, Math.floor((b.y + b.h - y0) / cell - 0.5));
            for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) solid[i + j * n] = 1;
        }
        const idx: number[] = [];
        for (let k = 0; k < solid.length; k++) if (solid[k]) idx.push(k);
        this.solidIdx = Int32Array.from(idx);
        this.solver.solidsChanged();
        for (const f of [this.d, this.t, this.s, this.u, this.v]) this.emptySolids(f);
    }

    /** Push the air, heat it, add soot or carve density around (st.x, st.y) for `dt` seconds. */
    stir(st: Stir, dt: number): void {
        if (!(dt > 0) || !isUsable(st)) return;
        const { n, cell, x0, y0, u, v, d, t, s, solid } = this;
        const blend = 1 - Math.exp(-st.rate * dt);
        const heat = (st.heat ?? 0) * dt, soot = (st.soot ?? 0) * dt, carve = (st.carve ?? 0) * dt;
        const radial = st.radial === true;
        const vx = Math.max(-MAX_STIR_SPEED, Math.min(MAX_STIR_SPEED, st.vx));
        const vy = Math.max(-MAX_STIR_SPEED, Math.min(MAX_STIR_SPEED, st.vy));
        const r2 = st.r * st.r, invR = 1 / st.r;
        const i0 = Math.max(1, Math.ceil((st.x - st.r - x0) / cell - 0.5)), i1 = Math.min(n - 2, Math.floor((st.x + st.r - x0) / cell - 0.5));
        const j0 = Math.max(1, Math.ceil((st.y - st.r - y0) / cell - 0.5)), j1 = Math.min(n - 2, Math.floor((st.y + st.r - y0) / cell - 0.5));
        for (let j = j0; j <= j1; j++) {
            const dy = y0 + (j + 0.5) * cell - st.y;
            for (let i = i0; i <= i1; i++) {
                const k = i + j * n;
                const dx = x0 + (i + 0.5) * cell - st.x;
                const dist2 = dx * dx + dy * dy;
                if (dist2 >= r2 || solid[k]) continue;
                const dist = Math.sqrt(dist2);
                const falloff = 1 - dist * invR;               // 1 at the centre, 0 at the reach
                const w = falloff * blend;                     // only the velocity follows at `rate`
                let tx = vx, ty = vy;
                if (radial) { const outward = dist > 1e-6 ? vx / dist : 0; tx = dx * outward; ty = dy * outward; }
                u[k] += (tx - u[k]) * w;
                v[k] += (ty - v[k]) * w;
                if (heat) t[k] = Math.min(HEAT_MAX, t[k] + heat * falloff);
                if (soot) s[k] = Math.min(SOOT_MAX, s[k] + soot * falloff);
                if (carve) d[k] *= Math.max(0, 1 - carve * falloff);
            }
        }
    }

    /** Advance the air by `dt` s: forces, vorticity, project, advect velocity, project, advect smoke. */
    step(dt: number): void {
        if (!(dt > 0)) return;
        const { u, v, d, t, s, scratch, solver } = this;
        this.emptySolids(u); this.emptySolids(v);        // the solver reads the cells next to a wall: no air may come out of one
        this.applyForces(dt);
        solver.confine(dt);
        solver.project();
        solver.traceBack(dt);
        solver.advect(u, scratch[0]); solver.advect(v, scratch[1]);
        u.set(scratch[0]); v.set(scratch[1]);
        this.emptySolids(u); this.emptySolids(v);
        solver.project();
        solver.traceBack(dt);
        solver.advect(d, scratch[0]); solver.advect(t, scratch[1]); solver.advect(s, scratch[2]);
        d.set(scratch[0]); t.set(scratch[1]); s.set(scratch[2]);
        this.emptySolids(d); this.emptySolids(t); this.emptySolids(s);
    }

    /** Total smoke density over the grid, in cell units (not px). */
    mass(): number {
        const { d } = this;
        let sum = 0;
        for (let k = 0; k < d.length; k++) sum += d[k];
        return sum;
    }

    private emptySolids(field: Float32Array): void {
        const { solidIdx } = this;
        for (let m = 0; m < solidIdx.length; m++) field[solidIdx[m]] = 0;
    }

    // Drag, cooling and the lift of hot air, over the whole array: solid and edge cells hold zeros
    private applyForces(dt: number): void {
        const { u, v, t } = this;
        const damp = Math.exp(-DAMP_PER_S * dt), cool = Math.exp(-COOL_PER_S * dt), lift = BUOYANCY * dt;
        for (let k = 0; k < t.length; k++) {
            v[k] = (v[k] - t[k] * lift) * damp;
            u[k] *= damp;
            t[k] *= cool;
        }
    }
}
