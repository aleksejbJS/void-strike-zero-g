// Drawing of the "Station Standard" flag: steel pole with brass collars and a crystal on
// top, and the cloth (shaded folds, dark hem with rivets, chevrons, swallowtail end).

import { Graphics } from 'pixi.js';
import { Vector2 } from '../../../types';
import { ClothShape, ClothSpec } from './flagCloth';
import { FlagPalette, mixColor } from './flagPalette';

const STEEL_DARK = 0x1d2228;
const STEEL_MID = 0x4a525c;
const STEEL_LIGHT = 0x8a94a0;
const BRASS = 0xb8893a;
const BRASS_SHADOW = 0x7a5a24;
const RIVET = 0xc9ced4;
const HEM = 0x0b0d10;

export const CRYSTAL_HEIGHT = 16;

/** Pole from the foot (0, 0) straight up to (0, -len), crystal above it. */
export const drawPole = (g: Graphics, len: number, pal: FlagPalette) => {
    g.rect(-3, -len, 6, len).fill(STEEL_DARK);
    g.rect(-2, -len, 4, len).fill(STEEL_MID);
    g.rect(-1, -len, 1.5, len).fill(STEEL_LIGHT);
    g.rect(-4.5, -len + 2, 9, 5).fill(BRASS);
    g.rect(-4.5, -len + 6, 9, 1).fill(BRASS_SHADOW);
    g.rect(-5, -7, 10, 7).fill(BRASS);
    g.rect(-5, -1, 10, 1).fill(BRASS_SHADOW);
    const tip = -len - CRYSTAL_HEIGHT;
    g.poly([0, tip, 5, -len - 7, 0, -len, -5, -len - 7]).fill(pal.light);
    g.poly([0, tip, 5, -len - 7, 0, -len - 7]).fill({ color: pal.main, alpha: 0.55 });
};

const shadeColor = (pal: FlagPalette, s: number) =>
    s > 0 ? mixColor(pal.main, pal.dark, s * 0.75) : mixColor(pal.main, pal.light, -s * 0.45);

const lerp = (a: Vector2, b: Vector2, t: number): Vector2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

const segment = (s: ClothShape, i: number): Vector2[] => {
    const last = i === s.shade.length - 1;
    return last && s.notch
        ? [s.top[i], s.top[i + 1], s.notch, s.bottom[i + 1], s.bottom[i]]
        : [s.top[i], s.top[i + 1], s.bottom[i + 1], s.bottom[i]];
};

const drawRivets = (g: Graphics, s: ClothShape) => {
    const upper = lerp(s.top[0], s.top[1], 0.5);
    const lower = lerp(s.bottom[0], s.bottom[1], 0.5);
    for (const f of [0.22, 0.78]) {
        const p = lerp(upper, lower, f);
        g.circle(p.x, p.y, 2).fill(RIVET);
    }
};

/** Two chevrons in the middle of the cloth pointing to the free end, following its tilt. */
const drawEmblem = (g: Graphics, s: ClothShape, spec: ClothSpec, pal: FlagPalette) => {
    const m = Math.round(spec.segments / 2);
    const c = lerp(s.top[m], s.bottom[m], 0.5);
    const a = Math.atan2(s.top[m + 1].y - s.top[m - 1].y, s.top[m + 1].x - s.top[m - 1].x);
    const size = spec.height * 0.3;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const at = (x: number, y: number) => ({ x: c.x + x * cos - y * sin, y: c.y + x * sin + y * cos });
    for (const dx of [-size * 0.35, size * 0.25]) {
        const p1 = at(dx - size * 0.4, -size * 0.55);
        const p2 = at(dx + size * 0.15, 0);
        const p3 = at(dx - size * 0.4, size * 0.55);
        g.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).lineTo(p3.x, p3.y)
            .stroke({ width: size * 0.3, color: pal.light, alpha: 0.9, join: 'miter' });
    }
};

/** Cloth in its local frame, pinned at (0, 0). */
export const drawCloth = (g: Graphics, s: ClothShape, spec: ClothSpec, pal: FlagPalette) => {
    s.shade.forEach((shade, i) => {
        const color = i === 0 ? mixColor(pal.dark, HEM, 0.4) : shadeColor(pal, shade);
        g.poly(segment(s, i)).fill(color).stroke({ width: 0.8, color });
    });
    drawRivets(g, s);
    drawEmblem(g, s, spec, pal);
    const outline = [...s.top, ...(s.notch ? [s.notch] : []), ...[...s.bottom].reverse()];
    g.poly(outline).stroke({ width: 1.2, color: 0x000000, alpha: 0.5 });
};
