// Torso patterns: paint on the armour (stripes, camo, split) and raised plates (the robot chest band, the hazard band).
// Shapes live in the torso frame (feet-up rig units, before the body width); `at` maps them to the drawing space.

import { Graphics } from 'pixi.js';
import { Vector2 } from '../../../../types';
import { PatternId } from '../../../build/buildParts';
import { FighterLook, shade } from '../fighterLook';
import { HAZARD, flat, outlinedPoly } from '../fighterPaint';
import { plateHighlight } from '../fighterDetails';
import { clipToConvex } from './convexClip';

const P = (x: number, y: number): Vector2 => ({ x, y });

/** The torso outline and its shaded back half, as drawTorso draws them. */
export const TORSO_QUAD = [P(-6.2, 0.5), P(6.2, 0.5), P(7.6, -19.5), P(-6.6, -20)];
export const TORSO_BACK = [P(-6.2, 0.5), P(-1.5, 0.5), P(-2.4, -20), P(-6.6, -20)];
export const TORSO_BACK_SHADE = 0.78;

const CAMO_DARK = 0.7;          // the second camo colour: the torso colour darkened by this
const HAZARD_BLACK = 0x15181c;

type Tone = 'pattern' | 'camo' | 'black' | 'yellow';

/**
 * One shape of a pattern. Paint lies on the armour under the strap and pouch and darkens on the back half.
 * A plate is a raised outlined piece over the strap and pouch; a stencil is flat colour on a plate.
 */
interface PatternPiece { points: Vector2[]; tone: Tone; kind: 'paint' | 'plate' | 'stencil' }

/** Which part of a pattern to draw: the paint, the raised plates, or both (for a torso without gear on it). */
export type PatternLayer = 'paint' | 'plate' | 'all';

const inTorso = (points: Vector2[]) => clipToConvex(points, TORSO_QUAD);

/** A wobbly ellipse: a camo blob. */
const blob = (cx: number, cy: number, rx: number, ry: number, rot: number, seed: number): Vector2[] =>
    Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2, wobble = 1 + 0.16 * Math.sin(3 * a + seed) + 0.08 * Math.sin(5 * a + 2 * seed);
        const ex = Math.cos(a) * rx * wobble, ey = Math.sin(a) * ry * wobble;
        return P(cx + ex * Math.cos(rot) - ey * Math.sin(rot), cy + ex * Math.sin(rot) + ey * Math.cos(rot));
    });

// In side view the front arm and the front thigh cover most of the chest, so the stripes run down the back half
// (in the same shade as the back) and half the camo blobs sit there.

/** A stripe from the hip line to above the shoulders, leaning like the back edge of the torso. */
const stripe = (left: number, width: number): Vector2[] =>
    [P(left, 1), P(left + width, 1), P(left + width - 0.45, -21), P(left - 0.45, -21)];

// The hazard band: a black plate just above the belt, with yellow slashes rising towards the front
const HAZARD_PLATE = inTorso([P(-7, -6.2), P(7, -6.3), P(7, -1.8), P(-7, -1.8)]);
const slash = (left: number): Vector2[] =>
    clipToConvex([P(left, -1.8), P(left + 1.2, -1.8), P(left + 4.7, -6.3), P(left + 3.5, -6.3)], HAZARD_PLATE);

// [x, y, x radius, y radius, turn] of each blob; even ones are in the pattern colour, odd ones in the dark torso colour
const CAMO: [number, number, number, number, number][] = [
    [-4.5, -17, 2, 1.9, 0.4], [-4.6, -11.6, 1.9, 2.2, -0.3], [-4.3, -5.6, 2.1, 1.8, 0.3],
    [2.6, -15, 2.6, 1.8, -0.25], [1, -9.6, 2.6, 2, 0.5], [4.6, -5, 2.2, 1.7, 0],
];

const PIECES: Record<PatternId, PatternPiece[]> = {
    none: [],
    band: [{ points: [P(-6.4, -12), P(7, -12.2), P(7.1, -9), P(-6.3, -8.8)], tone: 'pattern', kind: 'plate' }],
    stripes: [stripe(-5.7, 1.2), stripe(-3.8, 1.2)].map(s => ({ points: inTorso(s), tone: 'pattern', kind: 'paint' })),
    hazard: [
        { points: HAZARD_PLATE, tone: 'black', kind: 'plate' },
        ...[-10.6, -8.2, -5.8, -3.4, -1, 1.4, 3.8, 6.2].map(x => ({ points: slash(x), tone: 'yellow' as const, kind: 'stencil' as const })),
    ],
    camo: CAMO.map(([cx, cy, rx, ry, rot], i) => ({
        points: inTorso(blob(cx, cy, rx, ry, rot, i * 1.7)), tone: i % 2 === 0 ? 'pattern' : 'camo', kind: 'paint',
    })),
    split: [{ points: inTorso([P(-7, -21), P(8.6, -21), P(-7, 1.6)]), tone: 'pattern', kind: 'paint' }],
};

/** The shapes of a pattern in the torso frame (empty pieces are dropped). */
export const patternShapes = (pattern: PatternId): Vector2[][] =>
    PIECES[pattern].map(piece => piece.points).filter(points => points.length >= 3);

const colorOf = (tone: Tone, look: FighterLook) => {
    switch (tone) {
        case 'pattern': return look.pattern;
        case 'camo': return shade(look.torso, CAMO_DARK);
        case 'black': return HAZARD_BLACK;
        case 'yellow': return HAZARD;
    }
};

type At = (x: number, y: number) => Vector2;

const drawPiece = (g: Graphics, at: At, piece: PatternPiece, color: number) => {
    const map = (pts: Vector2[]) => pts.map(p => at(p.x, p.y));
    if (piece.kind === 'plate') {
        outlinedPoly(g, map(piece.points), color);
        return;
    }
    g.poly(flat(map(piece.points))).fill(color);
    if (piece.kind !== 'paint') return;
    const back = clipToConvex(piece.points, TORSO_BACK); // paint darkens where it wraps onto the back half
    if (back.length >= 3) g.poly(flat(map(back))).fill(shade(color, TORSO_BACK_SHADE));
};

/**
 * The pattern of the build in look.pattern. `at` maps torso-frame points to the drawing space, body width included.
 * The living fighter draws the paint before its strap and pouch and the plates after them; a ragdoll draws 'all'.
 */
export const drawPattern = (g: Graphics, at: At, look: FighterLook, layer: PatternLayer = 'all') => {
    const pieces = (PIECES[look.build.pattern] ?? PIECES.none).filter(piece =>
        piece.points.length >= 3 && (layer === 'all' || (piece.kind === 'paint') === (layer === 'paint')));
    pieces.forEach(piece => drawPiece(g, at, piece, colorOf(piece.tone, look)));
    // The light edge goes over the stencils, so it is drawn once the plate is finished
    pieces.filter(piece => piece.kind === 'plate').forEach(piece => plateHighlight(g, piece.points.map(p => at(p.x, p.y))));
};
