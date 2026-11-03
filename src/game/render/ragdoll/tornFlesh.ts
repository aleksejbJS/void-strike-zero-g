// Red ends where a corpse was torn or cut apart (rig units, drawn over the part they end).

import { Graphics } from 'pixi.js';
import { Vector2 } from '../../../types';
import { dot } from '../fighter/fighterPaint';

/** Torn flesh, and the darker middle of a torn joint. */
export const TORN = 0xb91c1c;
export const TORN_CORE = 0x5f0f14;
const END_R = 2.6;
const EDGE_W = 2.6;

/** A torn joint: a red dot with a dark middle. */
export const tornEnd = (g: Graphics, p: Vector2) => {
    dot(g, p, END_R, TORN);
    g.circle(p.x, p.y, END_R * 0.45).fill(TORN_CORE);
};

/** A clean cut across a body: a red line from `a` to `b`. */
export const tornEdge = (g: Graphics, a: Vector2, b: Vector2) => {
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: EDGE_W, color: TORN, cap: 'round' });
};
