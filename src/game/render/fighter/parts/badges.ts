// Badges on the front shoulder pad: chevrons, a two-digit number or an emblem, in look.pattern with a thin dark edge.
// Points are in the badge's own frame (rig units around the middle of the pad); `at` maps pad-frame points like shoulderPad.

import { Graphics } from 'pixi.js';
import { Vector2 } from '../../../../types';
import { EmblemId } from '../../../build/buildParts';
import { FighterLook } from '../fighterLook';
import { OUTLINE, flat } from '../fighterPaint';
import { ellipsePoints, roundRectPoints } from '../fighterDetails';
import { digitSegments } from './segmentDigits';

const P = (x: number, y: number): Vector2 => ({ x, y });

const PAD_MIDDLE = P(4.8, -18.3);  // middle of the pad [(0.5,-21), (8.5,-21.3), (9,-15.5), (1,-15.5)]
const EDGE = 0.7;                   // how much wider the dark edge is than the shape it rims
const CHEVRON_W = 1.1;
const DIGIT_LINE_W = 0.85;
const DIGITS_BOX = { x: -2.6, y: -1.75, w: 5.2, h: 3.5 };

type Stroke = Vector2[];   // an open polyline

const CHEVRONS: Stroke[] = [-1.6, 0.3].map(y => [P(-2.3, y), P(0, y + 1.2), P(2.3, y)]);

const star = (outer: number, inner: number): Vector2[] =>
    Array.from({ length: 10 }, (_, i) => {
        const r = i % 2 === 0 ? outer : inner, a = -Math.PI / 2 + (i * Math.PI) / 5;
        return P(Math.cos(a) * r, Math.sin(a) * r + 0.2);
    });

/** Filled shapes of each emblem, and the dark holes (eye sockets) drawn on top. */
const EMBLEM_SHAPES: Record<EmblemId, { fills: Vector2[][]; holes: Vector2[][] }> = {
    skull: {
        fills: [ellipsePoints(0, -0.55, 1.95, 1.7, 0), roundRectPoints(-1.15, 0.4, 2.3, 1.75, 0.45)],
        holes: [ellipsePoints(-0.75, -0.4, 0.55, 0.6, 0, 10), ellipsePoints(0.75, -0.4, 0.55, 0.6, 0, 10),
            [P(0, 0.45), P(0.3, 0.95), P(-0.3, 0.95)]],
    },
    star: { fills: [star(2.35, 1.0)], holes: [] },
    bolt: {
        fills: [[P(0, -2.2), P(1.7, -2.2), P(0.4, -0.4), P(1.5, -0.4), P(-1.4, 2.4), P(-0.4, 0.15), P(-1.6, 0.15)]],
        holes: [],
    },
};

type BadgeAt = (p: Vector2) => Vector2;

const strokeAll = (g: Graphics, at: BadgeAt, strokes: Stroke[], width: number, color: number) => {
    // All edges first, then all fills, so one stroke's edge never cuts across another's fill
    for (const pass of [{ w: width + EDGE, c: OUTLINE }, { w: width, c: color }]) {
        for (const line of strokes) {
            const [first, ...rest] = line.map(at);
            g.moveTo(first.x, first.y);
            for (const p of rest) g.lineTo(p.x, p.y);
            g.stroke({ width: pass.w, color: pass.c, cap: 'round', join: 'round' });
        }
    }
};

const fillAll = (g: Graphics, at: BadgeAt, shapes: Vector2[][], color: number) => {
    for (const shape of shapes) g.poly(flat(shape.map(at))).stroke({ width: EDGE, color: OUTLINE, join: 'round' });
    for (const shape of shapes) g.poly(flat(shape.map(at))).fill(color);
};

const digitStrokes = (n: number): Stroke[] =>
    digitSegments(n).map(seg => seg.map(p => P(DIGITS_BOX.x + p.x * DIGITS_BOX.w, DIGITS_BOX.y + p.y * DIGITS_BOX.h)));

/**
 * The build's badge on the front shoulder pad. `at` maps pad-frame points (feet-up rig units) to the drawing space.
 * `mirrored` flips the badge about its middle: pass true when the whole fighter is drawn mirrored (facing left),
 * so the number still reads the right way round.
 */
export const drawBadge = (g: Graphics, at: (x: number, y: number) => Vector2, look: FighterLook, mirrored = false) => {
    const { badge, badgeNumber, emblem } = look.build;
    const local: BadgeAt = p => at(PAD_MIDDLE.x + (mirrored ? -p.x : p.x), PAD_MIDDLE.y + p.y);
    switch (badge) {
        case 'none':
            return;
        case 'chevron':
            strokeAll(g, local, CHEVRONS, CHEVRON_W, look.pattern);
            return;
        case 'number':
            strokeAll(g, local, digitStrokes(badgeNumber), DIGIT_LINE_W, look.pattern);
            return;
        case 'emblem': {
            const { fills, holes } = EMBLEM_SHAPES[emblem];
            fillAll(g, local, fills, look.pattern);
            for (const hole of holes) g.poly(flat(hole.map(local))).fill(OUTLINE);
            return;
        }
    }
};
