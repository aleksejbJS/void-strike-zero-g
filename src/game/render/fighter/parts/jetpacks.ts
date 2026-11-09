// Jetpack bodies: today's pack, twin tanks, rocket, wings and scrap. Body colour is the jetpack colour pick.
// Shapes are designed in the upper-body frame (x back is negative, y up is negative) and stay inside today's
// x range (-12.5..-5); only the wings stick out. Nozzles and flames live in jetpackFlame.ts.

import { Graphics } from 'pixi.js';
import { Vector2 } from '../../../../types';
import { FighterPose, upperPoint } from '../fighterPose';
import { FighterLook, shade } from '../fighterLook';
import { GLOVE, HAZARD, OUTLINE, WHITE, dot, flat } from '../fighterPaint';
import { clipPoly, roundRectPoints } from '../fighterDetails';
import { limb, plate } from '../fighterParts';
import { PartMotionFrame } from './partMotionFrame';
import { drawNozzles } from './jetpackFlame';
import { drawWings } from './jetpackWings';

export { drawFlame, flameLength, flameMiddles, jetpackNozzles } from './jetpackFlame';

type Frame = (pts: Vector2[]) => Vector2[];
const P = (x: number, y: number): Vector2 => ({ x, y });
const METAL = 0x94a3b8;
const PIPE = 0x64748b;

/** Round shading of an upright cylinder of width w starting at x0: a light stripe on the left, shade on the right. */
export const cylinderShade = (g: Graphics, at: Frame, shape: Vector2[], x0: number, w: number, color: number) => {
    g.poly(flat(at(clipPoly(shape, p => x0 + w * 0.66 - p.x)))).fill(shade(color, 0.8));
    const stripe = clipPoly(clipPoly(shape, p => x0 + w * 0.16 - p.x), p => p.x - (x0 + w * 0.36));
    g.poly(flat(at(stripe))).fill({ color: WHITE, alpha: 0.3 });
};

/** Today's pack: a box with a hazard band and a dark nozzle block. */
const drawPack = (g: Graphics, at: Frame, look: FighterLook) => {
    plate(g, at([P(-12.5, -17), P(-5, -18), P(-5, -3), P(-12.5, -3)]), look.jet);
    plate(g, at([P(-11.5, -3), P(-6, -3), P(-6.5, -0.5), P(-11, -0.5)]), GLOVE, false);
    plate(g, at([P(-12.5, -12), P(-5, -12.5), P(-5, -10), P(-12.5, -9.5)]), HAZARD, false);
};

/** An upright tank: capsule with round shading and a dark nozzle cap under it. */
const tank = (g: Graphics, at: Frame, x0: number, w: number, top: number, bottom: number, color: number) => {
    const shape = roundRectPoints(x0, top, w, bottom - top, w / 2);
    plate(g, at(shape), color, false);
    cylinderShade(g, at, shape, x0, w, color);
    plate(g, at([P(x0 + 0.5, bottom - 0.2), P(x0 + w - 0.5, bottom - 0.2), P(x0 + w - 0.8, bottom + 1.4),
        P(x0 + 0.8, bottom + 1.4)]), GLOVE, false);
};

/** Twin tanks side by side: the front one is taller, so both domes show above the shoulders; a strap holds both. */
const drawTanks = (g: Graphics, at: Frame, look: FighterLook) => {
    tank(g, at, -10.2, 3.2, -22.6, -2.4, shade(look.jet, 0.8));
    tank(g, at, -12.5, 3.3, -18.4, -1.4, look.jet);
    plate(g, at([P(-12.5, -11.4), P(-6.8, -11.8), P(-6.8, -9.8), P(-12.5, -9.4)]), GLOVE, false);
    plate(g, at([P(-11.6, -11.3), P(-10.2, -11.4), P(-10.2, -9.5), P(-11.6, -9.4)]), HAZARD, false);
};

const ROCKET = { x0: -12.4, x1: -7.2, shoulder: -15, apex: -24.5, bottom: -1.6 };

/** The rocket hull: a cylinder whose nose curves to a point. */
const rocketHull = (): Vector2[] => {
    const { x0, x1, shoulder, apex, bottom } = ROCKET, mid = (x0 + x1) / 2, nose: Vector2[] = [];
    for (let i = 0; i <= 10; i++) {
        const t = i / 10, x = x0 + (x1 - x0) * t;
        nose.push(P(x, shoulder - (shoulder - apex) * Math.sqrt(Math.max(0, 1 - ((x - mid) / ((x1 - x0) / 2)) ** 2)) ** 1.6));
    }
    return [P(x0, bottom), ...nose, P(x1, bottom)];
};

/** Rocket: pointed nose, a porthole in the visor colour, fins in the pattern colour and an engine bell. */
const drawRocket = (g: Graphics, at: Frame, look: FighterLook) => {
    plate(g, at([P(-12.3, -8), P(-12.5, 3.4), P(-10.2, 1.2), P(-10.6, -2)]), look.pattern, false);
    const hull = rocketHull();
    plate(g, at(hull), look.jet, false);
    cylinderShade(g, at, hull, ROCKET.x0, ROCKET.x1 - ROCKET.x0, look.jet);
    plate(g, at([P(-12.4, -15.6), P(-7.2, -15.6), P(-7.2, -14), P(-12.4, -14)]), look.pattern, false);
    plate(g, at([P(-11.4, -1.6), P(-8.2, -1.6), P(-7.8, 0.6), P(-11.8, 0.6)]), GLOVE, false);
    const [port] = at([P(-10.4, -10)]);
    dot(g, port, 1.5, look.visor);
    g.circle(port.x - 0.5, port.y - 0.5, 0.55).fill({ color: WHITE, alpha: 0.8 });
};

/** A barrel that bulges at the middle, as a polygon. */
const barrel = (x0: number, x1: number, top: number, bottom: number, bulge: number): Vector2[] => {
    const side = (x: number, out: number) => Array.from({ length: 7 }, (_, i) => {
        const t = i / 6;
        return P(x + out * bulge * Math.sin(Math.PI * t), top + (bottom - top) * t);
    });
    return [...side(x1, 1), ...side(x0, -1).reverse()];
};

/** Scrap: a dented barrel with hoops, a riveted patch, a bent exhaust pipe and two mismatched nozzles. */
const drawScrap = (g: Graphics, at: Frame, look: FighterLook) => {
    const [p0, p1, p2] = at([P(-10.8, -17), P(-10.8, -21.4), P(-11.7, -22.4)]);
    limb(g, p0, p1, 1.8, PIPE);
    limb(g, p1, p2, 1.8, PIPE);
    dot(g, p2, 0.9, PIPE);
    g.circle(p2.x, p2.y, 0.45).fill(OUTLINE);
    plate(g, at([P(-11.6, -2.2), P(-9.2, -2.2), P(-9.4, 0), P(-11.4, 0)]), GLOVE, false);
    plate(g, at([P(-8.2, -2.2), P(-6.6, -2.2), P(-6.8, -0.6), P(-8, -0.6)]), METAL, false);
    const body = barrel(-12.1, -5.6, -18, -1.8, 0.4);
    plate(g, at(body), look.jet);
    g.poly(flat(at([P(-10.6, -16), P(-9.2, -15.6), P(-9.6, -14.4), P(-10.8, -14.8)]))).fill(shade(look.jet, 0.62));
    for (const y of [-14.2, -5.8]) {
        const [a, b] = at([P(-12.4, y), P(-5.3, y + 0.2)]);
        g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 1.3, color: OUTLINE });
    }
    plate(g, at([P(-11.7, -11.6), P(-8.6, -12), P(-8.4, -8.4), P(-11.5, -8.2)]), METAL);
    for (const r of at([P(-11, -11.1), P(-9.2, -11.3), P(-9.1, -9), P(-10.9, -8.8)])) g.circle(r.x, r.y, 0.45).fill(GLOVE);
};

/** The jetpack of the build, with its nozzle dots (bright while the flame burns); wings open with the part motion. */
export const drawJetpack = (g: Graphics, pose: FighterPose, look: FighterLook, flame: boolean, m: PartMotionFrame) => {
    const at: Frame = pts => pts.map(p => upperPoint(pose, p.x, p.y));
    switch (look.build.jetpack) {
        case 'pack': drawPack(g, at, look); break;
        case 'tanks': drawTanks(g, at, look); break;
        case 'rocket': drawRocket(g, at, look); break;
        case 'wings': drawWings(g, at, look, m.wingsOpen); break;
        case 'scrap': drawScrap(g, at, look); break;
    }
    drawNozzles(g, pose, look, flame);
};
