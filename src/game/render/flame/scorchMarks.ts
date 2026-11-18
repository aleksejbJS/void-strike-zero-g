// Soot left where splash fire burned out: a dark smudge along the wall or floor that fades over PATCH.markLife.
// Pure records; the Pixi side draws them under the fighters.

import { PATCH } from './flameTuning';

export interface Mark {
    active: boolean;
    x: number; y: number;
    w: number; h: number; // px
    life: number; ttl: number;
    alpha: number;
}

const PEAK = 0.5;
/** The last seconds of a mark's life, over which it fades out. */
const FADE_S = 3;

export class ScorchMarks {
    readonly items: Mark[];

    constructor(cap: number) {
        this.items = Array.from({ length: cap }, () => ({ active: false, x: 0, y: 0, w: 0, h: 0, life: 0, ttl: 1, alpha: 0 }));
    }

    /** A smudge of radius `r` at (x, y) on a surface facing (nx, ny); the oldest mark makes room when all are used. */
    add(x: number, y: number, r: number, nx: number): void {
        let m = this.items.find(k => !k.active);
        if (!m) m = this.items.reduce((a, b) => (b.life < a.life ? b : a));
        const along = r * 2.3, across = r * 1.05;
        const wall = Math.abs(nx) > 0.5;
        m.active = true;
        m.x = x; m.y = y;
        m.w = wall ? across : along;
        m.h = wall ? along : across;
        m.ttl = m.life = PATCH.markLife * (0.85 + Math.random() * 0.3);
        m.alpha = PEAK;
    }

    update(dt: number): void {
        for (const m of this.items) {
            if (!m.active) continue;
            m.life -= dt;
            if (m.life <= 0) { m.active = false; m.alpha = 0; continue; }
            m.alpha = PEAK * Math.min(1, m.life / FADE_S);
        }
    }

    clear(): void {
        for (const m of this.items) { m.active = false; m.alpha = 0; }
    }
}
