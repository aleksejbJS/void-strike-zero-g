// Fires that burn in place (after the owner's demo): splash fire where the stream hits a wall, floor or crate,
// and the fire on a burning fighter, which follows the body. Each one breathes flame cores, sparks and smoke
// into the shared pools; how its tongues look is patchLayout's job. Pure records, no Pixi.

import type { BodyOrder } from './flameOrders';
import type { FlamePools } from './flameStream';
import type { ScorchMarks } from './scorchMarks';
import { PATCH, SCALE, STREAM } from './flameTuning';

export interface Patch {
    active: boolean;
    body: string | null;   // id of the burning fighter, null for splash fire
    x: number; y: number;  // base of the fire on its surface (a fighter's feet)
    nx: number; ny: number; // outward normal of that surface
    r: number; rTarget: number;
    hBase: number;         // px, flame height this frame
    bodyH: number;         // px, flame height of a body fire (0 for splash fire)
    age: number; life: number; ttl: number;
    intensity: number;
    seed: number;
    acc: number;
}

const rnd = Math.random;
/** A splash fire fades over this much of the end of its life. */
const SPLASH_FADE = 0.6;

const blank = (): Patch => ({
    active: false, body: null, x: 0, y: 0, nx: 0, ny: -1, r: 0, rTarget: 0, hBase: 0, bodyH: 0,
    age: 0, life: 0, ttl: 1, intensity: 0, seed: 0, acc: 0,
});

export class FirePatches {
    readonly items: Patch[];

    constructor(cap: number, private readonly marks: ScorchMarks) {
        this.items = Array.from({ length: cap }, blank);
    }

    get burning(): number {
        return this.items.reduce((n, q) => n + (q.active ? 1 : 0), 0);
    }

    /** A stream core hit a surface: by chance it lights splash fire there or feeds the fire already burning nearby. */
    splash(x: number, y: number, nx: number, ny: number): void {
        if (rnd() > PATCH.stick) return;
        for (const q of this.items) {
            if (!q.active || q.body !== null || Math.abs(q.nx - nx) > 0.5 || Math.abs(q.ny - ny) > 0.5) continue;
            if (Math.abs(q.x - x) < q.rTarget * 0.9 + 16 * SCALE && Math.abs(q.y - y) < q.rTarget * 0.9 + 16 * SCALE) {
                q.life = Math.min(q.ttl, q.life + 0.3);
                q.rTarget = Math.min(PATCH.radius * 1.5, q.rTarget + 3 * SCALE);
                return;
            }
        }
        const q = this.take(false);
        this.light(q, x, y, nx, ny, PATCH.radius * (0.8 + rnd() * 0.4), PATCH.burnTime * (0.8 + rnd() * 0.4));
    }

    /** Fighter `id` burns this frame: its fire follows the body and dies out PATCH.bodyFade after the last order. */
    body(id: string, o: BodyOrder): void {
        let q = this.items.find(k => k.active && k.body === id);
        if (!q) {
            q = this.take(true);
            this.light(q, o.x, o.y, 0, -1, 0, PATCH.bodyFade);
            q.body = id;
        }
        q.x = o.x; q.y = o.y;
        q.rTarget = o.prone ? o.w * 1.2 : o.w * 0.6;
        if (q.r === 0) q.r = q.rTarget * 0.5;
        q.bodyH = o.prone ? o.h * 1.3 : o.h * 0.95; // a lying body is low and long: shorter flames over a wider bed
        q.life = q.ttl = PATCH.bodyFade;
    }

    update(dt: number, pools: FlamePools, share: number): void {
        for (const q of this.items) {
            if (!q.active) continue;
            q.age += dt; q.life -= dt;
            if (q.life <= 0) {
                if (q.body === null) this.marks.add(q.x, q.y, q.r, q.nx);
                this.put(q);
                continue;
            }
            const fadeOut = Math.min(1, q.life / (q.body === null ? SPLASH_FADE : PATCH.bodyFade));
            q.intensity = Math.min(1, q.age / 0.16) * fadeOut * PATCH.intensity;
            q.r += (q.rTarget - q.r) * Math.min(1, dt * 2.2);
            const wall = Math.abs(q.nx) > 0.5;
            q.hBase = q.body !== null
                ? q.bodyH
                : (q.r * 1.15 + 18 * SCALE) * PATCH.height * (wall ? 0.72 : 1);
            this.breathe(q, dt, pools, share, wall);
        }
    }

    clear(): void {
        for (const q of this.items) this.put(q);
    }

    /** Flame cores rising off the fire, now and then a spark and a wisp of smoke. */
    private breathe(q: Patch, dt: number, pools: FlamePools, share: number, wall: boolean): void {
        const I = Math.min(1.35, q.intensity), tx = -q.ny, ty = q.nx;
        q.acc += dt * (20 + q.r * 0.55 / SCALE) * I * share;
        let n = Math.min(14, Math.floor(q.acc));
        q.acc -= Math.floor(q.acc);
        while (n-- > 0) {
            const p = pools.fire.get(share);
            if (!p) break;
            const f = rnd() - 0.5, rise = q.hBase * (0.25 + rnd() * 0.55);
            p.x = q.x + tx * f * q.r * 1.25 + q.nx * (3 * SCALE + rise * 0.22);
            p.y = q.y + ty * f * q.r * 1.25 + q.ny * 3 * SCALE - rise * (wall ? 0.25 : 1);
            p.vx = (q.nx * (10 + rnd() * 28) + tx * (rnd() - 0.5) * 36) * SCALE;
            p.vy = -(50 + rnd() * 105) * SCALE;
            p.ttl = 0.34 + rnd() * 0.44;
            p.s0 = (14 + rnd() * 16) * SCALE; p.s1 = (34 + rnd() * 44) * SCALE;
            p.rot = rnd() * Math.PI * 2; p.vr = (rnd() - 0.5) * 3;
            p.seed = rnd() * 100; p.tOff = 0.04 + rnd() * 0.12; p.soft = 0.9;
        }
        if (rnd() < dt * (2.6 + STREAM.sparkRate * 0.05) * I * share) {
            const s = pools.spark.get(share);
            if (s) {
                s.x = q.x + tx * (rnd() - 0.5) * q.r; s.y = q.y + ty * (rnd() - 0.5) * q.r - q.hBase * 0.4;
                s.vx = (rnd() - 0.5) * 80 * SCALE; s.vy = -(70 + rnd() * 140) * SCALE;
                s.ttl = 0.5 + rnd() * 0.7; s.s0 = 2.4 + rnd() * 2.4;
            }
        }
        if (rnd() < dt * 3.4 * I * share) {
            const m = pools.smoke.get(share);
            if (m) {
                m.x = q.x + tx * (rnd() - 0.5) * q.r * 1.2 + q.nx * q.hBase * 0.2; m.y = q.y - q.hBase * 0.85;
                m.vx = (rnd() - 0.5) * 20 * SCALE; m.vy = -(30 + rnd() * 40) * SCALE;
                m.ttl = 1.3 + rnd() * 1.5;
                m.s0 = (20 + rnd() * 20) * SCALE; m.s1 = m.s0 * (2.4 + rnd());
                m.rot = rnd() * Math.PI * 2; m.vr = (rnd() - 0.5) * 0.7;
                m.aMax = 0.06 + rnd() * 0.07; m.seed = rnd() * 100;
            }
        }
    }

    /** A free fire, or the one closest to dying; a burning fighter may also push out splash fire. */
    private take(forBody: boolean): Patch {
        const free = this.items.find(q => !q.active);
        if (free) return free;
        const pool = forBody ? this.items.filter(q => q.body === null) : this.items;
        const victim = (pool.length ? pool : this.items).reduce((a, b) => (b.life < a.life ? b : a));
        this.put(victim);
        return victim;
    }

    private light(q: Patch, x: number, y: number, nx: number, ny: number, r: number, life: number): void {
        Object.assign(q, blank(), { active: true, x, y, nx, ny, rTarget: r, r: r * 0.5, life, ttl: life, seed: rnd() * 100 });
    }

    private put(q: Patch): void {
        q.active = false;
        q.body = null;
        q.intensity = 0;
    }
}
