// The winged jetpack: a compact pack with two short swept wings that hang folded along the pack on the ground
// and swing open behind the fighter in flight (wingsOpen from the part motion springs). Upper-body frame.

import { Graphics } from 'pixi.js';
import { Vector2 } from '../../../../types';
import { FighterLook, shade } from '../fighterLook';
import { GLOVE, HAZARD, OUTLINE } from '../fighterPaint';
import { roundRectPoints } from '../fighterDetails';
import { plate } from '../fighterParts';

type Frame = (pts: Vector2[]) => Vector2[];
const P = (x: number, y: number): Vector2 => ({ x, y });

const PIVOT = P(-10.2, -13.2);
// One wing, open, around the pivot: root edge on the pack, swept tip behind and a little up
const WING = [P(1, -1.6), P(-13, -3.6), P(-11, 1.6), P(-6, 3.4), P(0.6, 4.8)];
const RIB = [P(-0.4, 1.4), P(-10.6, -0.6)];
const ANGLE = { folded: -1.35, open: -0.12 }; // radians: folded hangs the tip down along the pack
const SPAN = { folded: 0.78, open: 1 };       // the folded wing looks shorter (it turns towards the viewer)
const FAR = { lift: P(1.2, -1.8), turn: 0.26, dark: 0.72 }; // the far wing peeks out above the near one

const ease = (t: number) => t * t * (3 - 2 * t);

const placeWing = (pts: Vector2[], open: number, turn: number, offset: Vector2): Vector2[] => {
    const t = ease(Math.max(0, Math.min(1, open)));
    const a = ANGLE.folded + (ANGLE.open - ANGLE.folded) * t + turn;
    const k = SPAN.folded + (SPAN.open - SPAN.folded) * t;
    const c = Math.cos(a), s = Math.sin(a);
    return pts.map(p => P(PIVOT.x + offset.x + (p.x * c - p.y * s) * k, PIVOT.y + offset.y + (p.x * s + p.y * c) * k));
};

const wing = (g: Graphics, at: Frame, color: number, open: number, turn: number, offset: Vector2) => {
    plate(g, at(placeWing(WING, open, turn, offset)), color);
    const [a, b] = at(placeWing(RIB, open, turn, offset));
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 0.9, color: shade(color, 0.6), cap: 'round' });
};

/** Compact pack with the wings, in the pattern colour, behind it. */
export const drawWings = (g: Graphics, at: Frame, look: FighterLook, open: number) => {
    wing(g, at, shade(look.pattern, FAR.dark), open, FAR.turn, FAR.lift);
    wing(g, at, look.pattern, open, 0, P(0, 0));
    plate(g, at(roundRectPoints(-12, -16.6, 7, 14.4, 2.2, 3)), look.jet);
    plate(g, at([P(-10.6, -2.4), P(-6.6, -2.4), P(-7, -0.7), P(-10.2, -0.7)]), GLOVE, false);
    plate(g, at([P(-12, -9.6), P(-5, -9.8), P(-5, -8), P(-12, -7.8)]), HAZARD, false);
    const [hinge] = at([PIVOT]);
    g.circle(hinge.x, hinge.y, 1.1).fill(OUTLINE);
    g.circle(hinge.x, hinge.y, 0.55).fill(shade(look.jet, 1.3));
};
