// How a fire burning in place looks this frame (after the owner's demo): a glowing ember bed on the surface,
// two soft flame masses, a row of flickering tongue flames (each an outer and a hotter inner one) and two
// washes of light. Pure: writes plain draw records, patchSprites copies them onto sprites.

import type { Patch } from './firePatches';
import type { FlameColors } from './flamePalettes';
import { GLOW, PATCH, STREAM } from './flameTuning';

/** One sprite's look in world px; anchors are fixed per sprite (masses and tongues stand on their base). */
export interface SpriteDraw { visible: boolean; x: number; y: number; angle: number; w: number; h: number; tint: number; alpha: number }

export interface PatchDraws {
    bed: SpriteDraw; lowGlow: SpriteDraw; highGlow: SpriteDraw; mass: SpriteDraw; mass2: SpriteDraw;
    tongues: { outer: SpriteDraw; inner: SpriteDraw }[];
}

const draw = (): SpriteDraw => ({ visible: false, x: 0, y: 0, angle: 0, w: 0, h: 0, tint: 0xffffff, alpha: 0 });

export const newPatchDraws = (): PatchDraws => ({
    bed: draw(), lowGlow: draw(), highGlow: draw(), mass: draw(), mass2: draw(),
    tongues: Array.from({ length: PATCH.maxTongues }, () => ({ outer: draw(), inner: draw() })),
});

const set = (d: SpriteDraw, x: number, y: number, angle: number, w: number, h: number, tint: number, alpha: number) => {
    d.visible = alpha > 0.002 && w > 0.5 && h > 0.5;
    d.x = x; d.y = y; d.angle = angle; d.w = w; d.h = h; d.tint = tint; d.alpha = alpha;
};

export const hidePatchDraws = (out: PatchDraws): void => {
    out.bed.visible = out.lowGlow.visible = out.highGlow.visible = out.mass.visible = out.mass2.visible = false;
    for (const t of out.tongues) t.outer.visible = t.inner.visible = false;
};

const rampAt = (c: FlameColors, i: number) => c.ramp[Math.max(0, Math.min(c.ramp.length - 1, Math.floor(i)))];

/** Lay out patch `q` at time `T` (s); a body fire gets fewer, taller tongues across the body. */
export const layoutPatch = (q: Patch, T: number, colors: FlameColors, out: PatchDraws): void => {
    if (!q.active) { hidePatchDraws(out); return; }
    const Iv = Math.min(1, Math.min(1.35, q.intensity));
    const soft = STREAM.softness;
    const wall = Math.abs(q.nx) > 0.5;
    const tx = -q.ny, ty = q.nx;
    const hBase = q.hBase;
    const flick = 0.74 + 0.26 * Math.sin(T * 19 + q.seed * 11) + 0.08 * Math.sin(T * 43 + q.seed * 5);
    const wob = Math.sin(T * 6.3 + q.seed) * 0.1 + Math.sin(T * 11.7 + q.seed * 2) * 0.05;

    set(out.mass, q.x + q.nx * 3, q.y + q.ny * 3, wall ? q.nx * 0.22 : 0,
        q.r * 2.5 * (1 + wob), hBase * 0.78 * (1 - wob * 0.6), rampAt(colors, 26), 0.3 * Iv * soft);
    set(out.mass2, q.x + q.nx * 4, q.y + q.ny * 4, wall ? q.nx * 0.18 : 0,
        q.r * 1.55 * (1 - wob * 0.8), hBase * 0.5 * (1 + wob * 0.5), rampAt(colors, 12), 0.26 * Iv * soft);

    const nT = q.body !== null ? 5 : Math.max(3, Math.min(PATCH.maxTongues, Math.round(PATCH.tongues)));
    const turb = 0.62 + 0.38 * Math.min(2, STREAM.turbulence);
    for (let k = 0; k < out.tongues.length; k++) {
        const { outer, inner } = out.tongues[k];
        if (k >= nT) { outer.visible = inner.visible = false; continue; }
        const f = (k + 0.5) / nT - 0.5;
        const sd = q.seed + k * 7.31;
        const n1 = (Math.sin(T * 8.1 + sd) * 0.5 + Math.sin(T * 14.7 + sd * 1.9) * 0.32 + Math.sin(T * 23.3 + sd * 0.6) * 0.18) * turb;
        const edge = 1 - Math.abs(f * 2) ** 1.7 * 0.4;
        const hh = hBase * edge * (0.7 + 0.3 * n1) * (0.45 + 0.55 * Iv);
        if (hh < 3) { outer.visible = inner.visible = false; continue; }
        const ww = hh * (0.72 + 0.12 * n1) * (q.body !== null ? 0.55 : 1);
        const bx = q.x + tx * f * q.r * 1.2 + q.nx * 3, by = q.y + ty * f * q.r * 1.2 + q.ny * 3;
        const lean = (wall ? q.nx * 0.28 : 0) + Math.sin(T * 3.7 + sd * 2.3) * 0.12 + n1 * 0.05;
        set(outer, bx, by, lean, ww, hh, rampAt(colors, 28 + 12 * n1), 0.26 * Iv * soft * (0.82 + 0.18 * n1));
        set(inner, bx, by, lean * 0.8, ww * 0.56, hh * 0.58, rampAt(colors, 8 + 7 * n1),
            0.3 * Iv * soft * (0.8 + 0.2 * Math.sin(T * 17 + sd * 3.1)));
    }

    const along = q.r * 2.1, across = q.r * 0.4;
    set(out.bed, q.x + q.nx * 1.5, q.y + q.ny * 1.5, 0, wall ? across : along, wall ? along : across,
        rampAt(colors, 44), 0.3 * Iv * flick);
    const gr = q.r * 3.2;
    set(out.lowGlow, q.x + q.nx * 2, q.y + q.ny * 2, 0, gr * (wall ? 0.5 : 1.15), gr * (wall ? 1.1 : 0.42),
        colors.glow, 0.17 * Iv * flick * GLOW.strength);
    const ar = q.r * 2.2 + hBase * 1.1;
    set(out.highGlow, q.x + q.nx * hBase * 0.3, q.y - hBase * 0.42, 0, ar * (wall ? 0.8 : 1.05), ar * 1.1,
        colors.glow, 0.22 * Iv * flick * GLOW.strength);
};
