// Volume details of the fighter: highlights, strap, pouch, visor sheen, specular, nozzle.
// Pure drawing on top of the plain shapes in fighterParts; nothing here moves a joint.

import { Graphics } from 'pixi.js';
import { Vector2 } from '../../../types';
import { FighterPose, upperPoint } from './fighterPose';
import { BOOT, TORSO_W } from './fighterStyle';
import { BELT, POUCH, VISOR, VISOR_GLINT, WHITE, flat, outlinedPoly } from './fighterPaint';

const DESIGN_HEAD_R = 7;   // the visor and specular numbers below were drawn for a head of this radius
const LIMB_LIGHT = { alpha: 0.22, width: 0.3, inset: 0.15, side: 0.28 };
const PLATE_LIGHT = { alpha: 0.28, width: 1, inset: 1, sink: 1 };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Torso points (feet-up rig units, x widened like the torso itself) in the drawing space. */
export const torsoPoint = (pose: FighterPose, x: number, y: number): Vector2 => upperPoint(pose, x * TORSO_W, y);

/**
 * Thin light stroke along the upper side of a limb. The side follows the limb smoothly: a limb
 * pointing down is lit on its front, one pointing back is lit on top, so nothing flips mid-stride.
 */
export const limbHighlight = (g: Graphics, a: Vector2, b: Vector2, width: number) => {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    if (len < 1) return;
    const side = clamp(1 + 4 * dx / len, -1, 1) * width * LIMB_LIGHT.side;
    const ox = dy / len * side, oy = -dx / len * side; // normal of the limb, scaled
    const i0 = LIMB_LIGHT.inset, i1 = 1 - LIMB_LIGHT.inset;
    g.moveTo(a.x + ox + dx * i0, a.y + oy + dy * i0).lineTo(a.x + ox + dx * i1, a.y + oy + dy * i1)
        .stroke({ width: width * LIMB_LIGHT.width, color: WHITE, alpha: LIMB_LIGHT.alpha, cap: 'round' });
};

/** Light line just inside the top edge (the edge with the highest middle) of a plate. */
export const plateHighlight = (g: Graphics, points: Vector2[]) => {
    let top = 0, topY = Infinity;
    points.forEach((p, i) => {
        const y = (p.y + points[(i + 1) % points.length].y) / 2;
        if (y < topY) { topY = y; top = i; }
    });
    const p = points[top], q = points[(top + 1) % points.length];
    const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy);
    if (len < 3 * PLATE_LIGHT.inset) return;
    const ux = dx / len, uy = dy / len;
    const cx = points.reduce((s, v) => s + v.x, 0) / points.length;
    const cy = points.reduce((s, v) => s + v.y, 0) / points.length;
    const toward = (-uy) * (cx - p.x) + ux * (cy - p.y) >= 0 ? 1 : -1; // the normal that points into the plate
    const nx = -uy * toward * PLATE_LIGHT.sink, ny = ux * toward * PLATE_LIGHT.sink;
    const s = PLATE_LIGHT.inset;
    g.moveTo(p.x + ux * s + nx, p.y + uy * s + ny).lineTo(q.x - ux * s + nx, q.y - uy * s + ny)
        .stroke({ width: PLATE_LIGHT.width, color: WHITE, alpha: PLATE_LIGHT.alpha, cap: 'round' });
};

/** Light patch on the upper-front quarter of the chest. */
export const drawChestLight = (g: Graphics, pose: FighterPose) => {
    const U = (x: number, y: number) => torsoPoint(pose, x, y);
    g.poly(flat([U(0.5, -19.3), U(7.2, -19.2), U(6.4, -12), U(0.5, -12.5)])).fill({ color: WHITE, alpha: 0.16 });
};

/** Strap from the back shoulder to the front hip, with a thin light line on its upper edge. */
export const drawStrap = (g: Graphics, pose: FighterPose) => {
    const from = torsoPoint(pose, -5, -19), to = torsoPoint(pose, 5.5, -3);
    g.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: 1.8, color: BELT });
    g.moveTo(from.x + 0.5, from.y - 0.6).lineTo(to.x + 0.5, to.y - 0.6).stroke({ width: 0.6, color: WHITE, alpha: 0.18 });
};

/** Dark pouch on the lower back. */
export const drawPouch = (g: Graphics, pose: FighterPose) => {
    const U = (x: number, y: number) => torsoPoint(pose, x, y);
    outlinedPoly(g, [U(-3.5, -9), U(1, -9), U(1, -4.5), U(-3.5, -4.5)], POUCH);
};

/** Small light dot on a glove. */
export const handGlint = (g: Graphics, p: Vector2) =>
    g.circle(p.x - 0.6, p.y - 0.7, 0.9).fill({ color: WHITE, alpha: 0.25 });

/** Light sole line across the bottom of a boot whose top-left corner is (x, y). */
export const soleLine = (g: Graphics, x: number, y: number) =>
    g.rect(x + 0.5, y + BOOT.h - 1.2, BOOT.w - 1, 1).fill({ color: 0x9aa4b2, alpha: 0.5 });

/** Orange nozzle dot under the jetpack: bright while the flame burns. */
export const drawNozzle = (g: Graphics, pose: FighterPose, lit: boolean) => {
    const p = upperPoint(pose, -8.75, -1.2);
    g.circle(p.x, p.y, 1.6).fill({ color: 0xffb347, alpha: lit ? 0.9 : 0.25 });
};

/** Ellipse as a polygon (Graphics ellipses cannot be rotated). */
const ellipsePoints = (cx: number, cy: number, rx: number, ry: number, rot: number, steps = 16): Vector2[] =>
    Array.from({ length: steps }, (_, i) => {
        const a = (i / steps) * Math.PI * 2, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
        return { x: cx + ex * Math.cos(rot) - ey * Math.sin(rot), y: cy + ex * Math.sin(rot) + ey * Math.cos(rot) };
    });

/** Glossy spot on the upper left of a head of radius r (around the head's origin). */
export const drawSpecular = (g: Graphics, r: number) => {
    const k = r / DESIGN_HEAD_R;
    g.poly(flat(ellipsePoints(-1.5 * k, -4.2 * k, 3.2 * k, 1.5 * k, -0.5))).fill({ color: WHITE, alpha: 0.35 });
};

const roundRectPoints = (x: number, y: number, w: number, h: number, r: number, steps = 5): Vector2[] => {
    const pts: Vector2[] = [];
    const corner = (cx: number, cy: number, from: number) => {
        for (let i = 0; i <= steps; i++) {
            const a = from + (Math.PI / 2) * (i / steps);
            pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
        }
    };
    corner(x + w - r, y + r, -Math.PI / 2);
    corner(x + w - r, y + h - r, 0);
    corner(x + r, y + h - r, Math.PI / 2);
    corner(x + r, y + r, Math.PI);
    return pts;
};

/** The part of a convex polygon where f(p) <= 0 (one Sutherland-Hodgman pass). */
const clipPoly = (pts: Vector2[], f: (p: Vector2) => number): Vector2[] => {
    const out: Vector2[] = [];
    pts.forEach((p, i) => {
        const q = pts[(i + 1) % pts.length], fp = f(p), fq = f(q);
        if (fp <= 0) out.push(p);
        if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
            const t = fp / (fp - fq);
            out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
        }
    });
    return out;
};

/** Glass over a rounded window, as three steps from its upper left to its lower right (no gradient fills in Pixi Graphics). */
export const visorSheen = (g: Graphics, x: number, y: number, w: number, h: number, r: number) => {
    const shape = roundRectPoints(x, y, w, h, r);
    const along = (p: Vector2) => ((p.x - x) * w + (p.y - y) * h) / (w * w + h * h); // 0 at the upper left, 1 at the lower right
    g.poly(flat(shape)).fill({ color: VISOR_GLINT, alpha: 0.08 });
    g.poly(flat(clipPoly(shape, p => along(p) - 0.22))).fill({ color: VISOR_GLINT, alpha: 0.55 });
    g.poly(flat(clipPoly(shape, p => 0.82 - along(p)))).fill({ color: WHITE, alpha: 0.25 });
};

/** Dark visor with its sheen, for a head of radius r. */
export const drawVisor = (g: Graphics, r: number) => {
    const k = r / DESIGN_HEAD_R;
    g.roundRect(1 * k, -3 * k, 7.4 * k, 5.4 * k, 2.4 * k).fill(VISOR);
    visorSheen(g, 1 * k, -3 * k, 7.4 * k, 5.4 * k, 2.4 * k);
};
