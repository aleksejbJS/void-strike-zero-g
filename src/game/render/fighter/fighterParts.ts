// Drawing primitives and body parts of the fighter (Pixi Graphics, rig space).

import { Graphics } from 'pixi.js';
import { Vector2 } from '../../../types';
import { FighterPose, upperPoint } from './fighterPose';
import { FighterLook, shade } from './fighterLook';
import { BOOT } from './fighterStyle';
import { BELT, GLOVE, HAZARD, OUTLINE, OUTLINE_W, dot, flat, outlinedPoly } from './fighterPaint';
import {
    drawChestLight, drawPouch, drawStrap, handGlint, limbHighlight, plateHighlight, soleLine, torsoPoint,
} from './fighterDetails';

/** A limb segment: rounded bar with an outline and a light line along its upper side. */
export const limb = (g: Graphics, a: Vector2, b: Vector2, width: number, color: number) => {
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: width + OUTLINE_W, color: OUTLINE, cap: 'round' });
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width, color, cap: 'round' });
    limbHighlight(g, a, b, width);
};

/** Upper and lower segment of an arm or leg: [upper, lower]. */
export interface LimbLook { widths: [number, number]; colors: [number, number] }

/**
 * A bent arm or leg drawn as one piece: both outlines, then both fills, then the highlights.
 * Drawing the segments one by one would lay the lower outline across the upper fill at the joint.
 */
export const jointedLimb = (g: Graphics, root: Vector2, joint: Vector2, end: Vector2, look: LimbLook) => {
    const segments: [Vector2, Vector2][] = [[root, joint], [joint, end]];
    segments.forEach(([a, b], i) =>
        g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: look.widths[i] + OUTLINE_W, color: OUTLINE, cap: 'round' }));
    segments.forEach(([a, b], i) =>
        g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: look.widths[i], color: look.colors[i], cap: 'round' }));
    segments.forEach(([a, b], i) => limbHighlight(g, a, b, look.widths[i]));
};

/** A filled outlined polygon with a light line along its top edge (`lit` false for belts and straps). */
export const plate = (g: Graphics, points: Vector2[], color: number, lit = true) => {
    outlinedPoly(g, points, color);
    if (lit) plateHighlight(g, points);
};

export const hand = (g: Graphics, p: Vector2) => {
    dot(g, p, 2.3, GLOVE);
    handGlint(g, p);
};

export const boot = (g: Graphics, ankle: Vector2, color: number) => {
    const x = ankle.x - BOOT.heel, y = ankle.y - 2.4; // the sole ends on the feet line
    g.roundRect(x, y, BOOT.w, BOOT.h, 2).stroke({ width: OUTLINE_W, color: OUTLINE });
    g.roundRect(x, y, BOOT.w, BOOT.h, 2).fill(color);
    soleLine(g, x, y);
};

/** Pad on the front shoulder. `at` maps torso-frame points (feet-up rig units) to the drawing space. */
export const shoulderPad = (g: Graphics, at: (x: number, y: number) => Vector2, torso: number) =>
    plate(g, [at(0.5, -21), at(8.5, -21.3), at(9, -15.5), at(1, -15.5)], shade(torso, 0.9));

export const drawTorso = (g: Graphics, pose: FighterPose, look: FighterLook) => {
    const U = (x: number, y: number) => torsoPoint(pose, x, y); // torso points get the body width
    plate(g, [U(-6.2, 0.5), U(6.2, 0.5), U(7.6, -19.5), U(-6.6, -20)], look.torso);
    g.poly(flat([U(-6.2, 0.5), U(-1.5, 0.5), U(-2.4, -20), U(-6.6, -20)])).fill(shade(look.torso, 0.78));
    drawChestLight(g, pose);
    drawStrap(g, pose);
    drawPouch(g, pose);
    const a = U(1.5, -17.5), b = U(6, -17.8);
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 1.2, color: shade(look.torso, 1.35), cap: 'round' });
    if (look.build.pattern === 'band') plate(g, [U(-6.4, -12), U(7, -12.2), U(7.1, -9), U(-6.3, -8.8)], look.pattern);
    plate(g, [U(-6.4, -1.8), U(6.4, -1.8), U(6.3, 1.6), U(-6.3, 1.6)], BELT, false);
    plate(g, [U(2, -1.2), U(4.6, -1.2), U(4.6, 1), U(2, 1)], HAZARD, false);
    shoulderPad(g, (x, y) => upperPoint(pose, x, y), look.torso); // under the front arm
};
