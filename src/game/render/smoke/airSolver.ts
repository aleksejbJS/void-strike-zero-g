// The numeric kernels of the air grid, kept apart from its state: vorticity confinement, pressure
// projection and semi-Lagrangian advection over flat typed arrays (no closures, no per-cell hypot or
// atan2). It owns the scratch buffers and works on the velocity and solid arrays it is given, so the
// AirGrid decides when each kernel runs. Index k = i + j * n; the outermost ring of cells is the open
// box edge and is never written.

import { PRESSURE_ITERS, VORTICITY } from './smokeTuning';

const CURL_EPS = 1e-5;                    // keeps the curl-gradient direction finite where the gradient is zero

export class AirSolver {
    private readonly invDiag: Float32Array;     // 1 / (open neighbours of a cell), 0 for solid and edge cells
    private readonly p: Float32Array;           // pressure; stays 0 in solid and edge cells
    private readonly div: Float32Array;
    private readonly curl: Float32Array;
    private readonly curlAbs: Float32Array;
    private readonly traceIdx: Int32Array;      // backtrace: top-left source cell of each cell
    private readonly traceA: Float32Array;      //            horizontal weight
    private readonly traceB: Float32Array;      //            vertical weight

    constructor(
        private readonly n: number, private readonly cell: number,
        private readonly u: Float32Array, private readonly v: Float32Array, private readonly solid: Uint8Array,
    ) {
        const make = () => new Float32Array(n * n);
        this.invDiag = make(); this.p = make(); this.div = make(); this.curl = make(); this.curlAbs = make();
        this.traceA = make(); this.traceB = make();
        this.traceIdx = new Int32Array(n * n);
        this.solidsChanged();
    }

    /** Call after the solid array changed: recount the open neighbours of every cell. */
    solidsChanged(): void {
        const { n, solid, invDiag } = this;
        invDiag.fill(0);
        for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
            const k = i + j * n;
            if (solid[k]) continue;
            const open = 4 - solid[k - 1] - solid[k + 1] - solid[k - n] - solid[k + n];
            invDiag[k] = open > 0 ? 1 / open : 0;
        }
    }

    /** Vorticity confinement: push the air around the strongest swirls so they keep turning. */
    confine(dt: number): void {
        const { n, u, v, curl, curlAbs, solid } = this;
        const inv2c = 1 / (2 * this.cell), gain = VORTICITY * this.cell * dt;
        for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
            const k = i + j * n;
            const c = ((v[k + 1] - v[k - 1]) - (u[k + n] - u[k - n])) * inv2c;
            curl[k] = c;
            curlAbs[k] = Math.abs(c);
        }
        for (let j = 2; j < n - 2; j++) for (let i = 2; i < n - 2; i++) {
            const k = i + j * n;
            if (solid[k]) continue;
            const gx = curlAbs[k + 1] - curlAbs[k - 1], gy = curlAbs[k + n] - curlAbs[k - n];
            const f = gain * curl[k] / (Math.sqrt(gx * gx + gy * gy) + CURL_EPS);
            u[k] += f * gy;
            v[k] -= f * gx;
        }
    }

    /** Make the air incompressible: Gauss-Seidel pressure in red-black order (solid neighbours take the
     *  centre value, the box edge is open at pressure 0), then subtract its gradient from the velocity. */
    project(): void {
        const { n, u, v, p, div, invDiag, solid } = this;
        for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
            const k = i + j * n;
            div[k] = -0.5 * (u[k + 1] - u[k - 1] + v[k + n] - v[k - n]);
        }
        p.fill(0);
        // Red-black sweeps: the cells of one colour only read the other colour, so no update waits
        // for the one before it (a plain row-by-row sweep is a serial chain and twice as slow)
        for (let it = 0; it < PRESSURE_ITERS; it++) {
            for (let color = 0; color < 2; color++) {
                for (let j = 1; j < n - 1; j++) {
                    const row = j * n, end = row + n - 1;
                    for (let k = row + 1 + (((1 + j) & 1) ^ color); k < end; k += 2) {
                        p[k] = (div[k] + p[k - 1] + p[k + 1] + p[k - n] + p[k + n]) * invDiag[k];
                    }
                }
            }
        }
        for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
            const k = i + j * n;
            if (solid[k]) continue;
            const pc = p[k];
            u[k] -= 0.5 * ((solid[k + 1] ? pc : p[k + 1]) - (solid[k - 1] ? pc : p[k - 1]));
            v[k] -= 0.5 * ((solid[k + n] ? pc : p[k + n]) - (solid[k - n] ? pc : p[k - n]));
        }
    }

    /** Where each cell's air came from `dt` seconds ago; stored once, then applied to several fields. */
    traceBack(dt: number): void {
        const { n, u, v, traceIdx, traceA, traceB } = this;
        const f = dt / this.cell, lo = 0.5, hi = n - 1.5;
        for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
            const k = i + j * n;
            let x = i - u[k] * f, y = j - v[k] * f;
            if (!(x >= lo)) x = lo; else if (x > hi) x = hi;       // also catches NaN
            if (!(y >= lo)) y = lo; else if (y > hi) y = hi;
            const xi = x | 0, yi = y | 0;
            traceIdx[k] = xi + yi * n;
            traceA[k] = x - xi;
            traceB[k] = y - yi;
        }
    }

    /** dst = src sampled at the last traced positions (bilinear); the edge ring of dst is left as it was. */
    advect(src: Float32Array, dst: Float32Array): void {
        const { n, traceIdx, traceA, traceB } = this;
        for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
            const k = i + j * n, m = traceIdx[k], a = traceA[k];
            const top = src[m] + a * (src[m + 1] - src[m]);
            const bottom = src[m + n] + a * (src[m + n + 1] - src[m + n]);
            dst[k] = top + traceB[k] * (bottom - top);
        }
    }
}
