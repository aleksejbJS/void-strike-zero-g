// Palette and the plain outlined shapes of the fighter drawing (no highlights: those live in fighterDetails).

import { Graphics } from 'pixi.js';
import { Vector2 } from '../../../types';

export const OUTLINE = 0x07090c;
export const OUTLINE_W = 2.2;
export const BELT = 0x1a1d21;
export const HAZARD = 0xffc21a;
export const GLOVE = 0x2b3038;
export const VISOR = 0x0e1116;
export const VISOR_GLINT = 0x7fd3ff;
export const POUCH = 0x2f3640;
export const WHITE = 0xffffff;

export const flat = (points: Vector2[]) => points.flatMap(p => [p.x, p.y]);

/** A filled polygon with an outline. The outline goes underneath so the fill keeps its full size. */
export const outlinedPoly = (g: Graphics, points: Vector2[], color: number) => {
    g.poly(flat(points)).stroke({ width: OUTLINE_W, color: OUTLINE, join: 'round' });
    g.poly(flat(points)).fill(color);
};

export const dot = (g: Graphics, p: Vector2, r: number, color: number) => {
    g.circle(p.x, p.y, r + OUTLINE_W / 2).fill(OUTLINE);
    g.circle(p.x, p.y, r).fill(color);
};
