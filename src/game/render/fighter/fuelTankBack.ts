// The fuel tank a flamethrower carrier wears on the back, peeking out behind the jetpack, and the hose
// from its valve to the gun. Drawn into the fighter's body layer, in rig units of the upper-body frame
// (x back is negative, y up is negative), so it leans, crouches and lies down with the body.

import { Graphics } from 'pixi.js';
import { Vector2 } from '../../../types';
import { FighterPose, upperPoint } from './fighterPose';
import { GripPoints } from './weaponGrips';
import { GLOVE, HAZARD, OUTLINE, OUTLINE_W } from './fighterPaint';
import { roundRectPoints } from './fighterDetails';
import { plate } from './fighterParts';
import { cylinderShade } from './parts/jetpacks';

/** The upright tank: its back edge, width, dome top and bottom. The jetpack (x -12.5..-5) covers its front edge. */
export const TANK_BOX = { x0: -17.6, w: 7, top: -22, bottom: -1 };
/**
 * Where a lit tank's jet comes out (fighterFire.ts): the middle of the tank. A corpse's tank
 * (systems/ragdoll/corpseTank.ts: 14 behind the spine, 10 up from the hip) uses the same spot.
 */
export const TANK_SPOT: Vector2 = { x: -14, y: -10 };

export const TANK_COLOR = 0xc2410c;
export const HOSE_COLOR = 0x23272d;
const VALVE = 0x8a949e;
const HOSE_W = 2.6;
/** Where the hose meets the gun: the coupling of the hose stub on public/assets/hud/flamethrower.png (fractions). */
const HOSE_ON_GUN: [number, number] = [0.13, 0.86];
/** The hose sags this far (rig units) below the straight line from the tank to the gun. */
const HOSE_SAG = 7;

const P = (x: number, y: number): Vector2 => ({ x, y });

/** The tank on the back: a capsule with round shading, a hazard band, a valve on the dome and one at the bottom. */
export const drawFuelTank = (g: Graphics, pose: FighterPose) => {
    const at = (pts: Vector2[]) => pts.map(p => upperPoint(pose, p.x, p.y));
    const { x0, w, top, bottom } = TANK_BOX;
    const shape = roundRectPoints(x0, top, w, bottom - top, w / 2);
    plate(g, at(shape), TANK_COLOR, false);
    cylinderShade(g, at, shape, x0, w, TANK_COLOR);
    plate(g, at([P(x0, -13), P(x0 + w, -13.2), P(x0 + w, -10.8), P(x0, -10.6)]), HAZARD, false);
    plate(g, at([P(-15.4, top - 1.6), P(-12.8, top - 1.6), P(-12.8, top + 0.6), P(-15.4, top + 0.6)]), VALVE, false);
    plate(g, at([P(-15.6, bottom - 0.4), P(-12.4, bottom - 0.4), P(-12.8, bottom + 1.6), P(-15.2, bottom + 1.6)]), GLOVE, false);
};

/** The hose from the tank's bottom valve to the coupling under the gun, sagging between them. */
export const drawFuelHose = (g: Graphics, pose: FighterPose, grip: GripPoints) => {
    const from = upperPoint(pose, -14, TANK_BOX.bottom + 1.4);
    const c = Math.cos(pose.gunAngle), s = Math.sin(pose.gunAngle);
    const gx = HOSE_ON_GUN[0] * grip.length, gy = HOSE_ON_GUN[1] * grip.height;
    const to = { x: pose.gunTopLeft.x + c * gx - s * gy, y: pose.gunTopLeft.y + s * gx + c * gy };
    const bend = { x: (from.x + to.x) / 2, y: Math.max(from.y, to.y) + HOSE_SAG };
    for (const [width, color] of [[HOSE_W + OUTLINE_W, OUTLINE], [HOSE_W, HOSE_COLOR]]) {
        g.moveTo(from.x, from.y).quadraticCurveTo(bend.x, bend.y, to.x, to.y).stroke({ width, color, cap: 'round' });
    }
};
