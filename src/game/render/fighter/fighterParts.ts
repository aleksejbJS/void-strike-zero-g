// Drawing primitives and body parts of the fighter (Pixi Graphics, rig space).

import { Graphics } from 'pixi.js';
import { Vector2 } from '../../../types';
import { FighterPose, upperPoint } from './fighterPose';
import { FighterLook, shade } from './fighterLook';
import { BOOT, HEAD_K, HEAD_R, ROBOT_HEAD_K } from './fighterStyle';
import { BELT, GLOVE, HAZARD, OUTLINE, OUTLINE_W, VISOR_GLINT, WHITE, dot, flat, outlinedPoly } from './fighterPaint';
import {
    drawChestLight, drawNozzle, drawPouch, drawSpecular, drawStrap, drawVisor, handGlint, limbHighlight,
    plateHighlight, soleLine, torsoPoint, visorSheen,
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

export const FLAME_BASE = { x: -8.75, y: -1 };   // in the upper-body frame
export const flameLength = (flicker: number) => 10 + flicker * 5;

export const drawFlame = (g: Graphics, pose: FighterPose, flicker: number) => {
    const base = upperPoint(pose, FLAME_BASE.x, FLAME_BASE.y);
    const len = flameLength(flicker);
    const tipX = base.x - pose.lean * len;
    g.poly([base.x - 3, base.y, tipX, base.y + len, base.x + 3, base.y]).fill(0xff8a1e);
    g.poly([base.x - 1.6, base.y, base.x - pose.lean * len * 0.6, base.y + len * 0.6, base.x + 1.6, base.y]).fill(0xffe27a);
    g.poly([base.x - 0.8, base.y, base.x - pose.lean * len * 0.3, base.y + len * 0.3, base.x + 0.8, base.y]).fill(WHITE);
};

export const drawJetpack = (g: Graphics, pose: FighterPose, look: FighterLook, flame: boolean) => {
    const U = (x: number, y: number) => upperPoint(pose, x, y);
    plate(g, [U(-12.5, -17), U(-5, -18), U(-5, -3), U(-12.5, -3)], look.jet);
    plate(g, [U(-11.5, -3), U(-6, -3), U(-6.5, -0.5), U(-11, -0.5)], GLOVE, false);
    plate(g, [U(-12.5, -12), U(-5, -12.5), U(-5, -10), U(-12.5, -9.5)], HAZARD, false);
    drawNozzle(g, pose, flame);
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
    if (look.style === 'robot') plate(g, [U(-6.4, -12), U(7, -12.2), U(7.1, -9), U(-6.3, -8.8)], look.accent);
    plate(g, [U(-6.4, -1.8), U(6.4, -1.8), U(6.3, 1.6), U(-6.3, 1.6)], BELT, false);
    plate(g, [U(2, -1.2), U(4.6, -1.2), U(4.6, 1), U(2, 1)], HAZARD, false);
    shoulderPad(g, (x, y) => upperPoint(pose, x, y), look.torso); // under the front arm
};

/** Beasts and aliens have a tail that swings with the run cycle. */
export const drawTail = (g: Graphics, pose: FighterPose, look: FighterLook, swing: number) => {
    if (look.style !== 'beast' && look.style !== 'alien') return;
    const root = upperPoint(pose, -6, -1);
    const tip = { x: root.x - 9, y: root.y + 3 + swing * 3 };
    limb(g, root, tip, 3, look.accent);
};

/** The ridge line over the top of a helmet, around the head's origin. */
export const helmetRidge = (g: Graphics) => {
    const r = HEAD_R - 2.2, from = Math.PI * 1.15, to = Math.PI * 1.75;
    g.moveTo(r * Math.cos(from), r * Math.sin(from)).arc(0, 0, r, from, to).stroke({ width: 1.2, color: OUTLINE, cap: 'round' });
};

/** Head drawn around its own origin; the view positions and tilts it. */
export const drawHead = (g: Graphics, look: FighterLook) => {
    if (look.style === 'robot') {
        const k = ROBOT_HEAD_K;
        g.moveTo(1 * k, -6.5 * k).lineTo(1 * k, -10.5 * k).stroke({ width: 1.6 + OUTLINE_W, color: OUTLINE, cap: 'round' });
        g.moveTo(1 * k, -6.5 * k).lineTo(1 * k, -10.5 * k).stroke({ width: 1.6, color: look.accent, cap: 'round' });
        g.roundRect(-6 * k, -6.5 * k, 13 * k, 12 * k, 2.5 * k).stroke({ width: OUTLINE_W, color: OUTLINE });
        g.roundRect(-6 * k, -6.5 * k, 13 * k, 12 * k, 2.5 * k).fill(look.head);
        g.roundRect(-1 * k, -3 * k, 8 * k, 4.5 * k, 1.5 * k).fill(look.accent);
        visorSheen(g, -1 * k, -3 * k, 8 * k, 4.5 * k, 1.5 * k);
        const l = -6 * k + 1.5, r = 7 * k - 1.5, t = -6.5 * k, b = 5.5 * k; // the straight part of the box edges
        plateHighlight(g, [{ x: l, y: t }, { x: r, y: t }, { x: r, y: b }, { x: l, y: b }]);
        return;
    }
    const k = HEAD_K;
    const P = (x: number, y: number) => ({ x: x * k, y: y * k }); // ears and antennae keep their size relative to the head
    if (look.style === 'beast') {
        plate(g, [P(-5.5, -3), P(-3.5, -11), P(-0.5, -5)], look.head);
        plate(g, [P(0.5, -5.5), P(3.5, -11.5), P(5, -3.5)], look.head);
    }
    if (look.style === 'alien') {
        limb(g, P(-1, -6), P(-4, -12), 1.2, look.head);
        limb(g, P(2, -6), P(4, -12.5), 1.2, look.head);
        dot(g, P(-4, -12), 1.6, look.accent);
        dot(g, P(4, -12.5), 1.6, look.accent);
    }
    dot(g, { x: 0, y: 0 }, HEAD_R, look.head);
    g.moveTo(0, 0).arc(0, 0, HEAD_R, Math.PI * 0.55, Math.PI * 1.25).closePath().fill(shade(look.head, 0.75));
    drawSpecular(g, HEAD_R);
    if (look.style === 'human') helmetRidge(g);
    drawVisor(g, HEAD_R);
    const glint = look.style === 'human' ? VISOR_GLINT : look.accent;
    g.moveTo(2.6 * k, -1.8 * k).lineTo(7 * k, -1.8 * k).stroke({ width: 1, color: glint, cap: 'round' });
};
