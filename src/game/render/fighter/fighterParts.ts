// Drawing primitives and body parts of the fighter (Pixi Graphics, rig space).

import { Graphics } from 'pixi.js';
import { Vector2 } from '../../../types';
import { FighterPose, upperPoint } from './fighterPose';
import { FighterLook, shade } from './fighterLook';

export const OUTLINE = 0x07090c;
const OUTLINE_W = 2.2;
const BELT = 0x1a1d21;
const HAZARD = 0xffc21a;
const GLOVE = 0x2b3038;
const VISOR = 0x0e1116;
const VISOR_GLINT = 0x7fd3ff;

const flat = (points: Vector2[]) => points.flatMap(p => [p.x, p.y]);

/** A limb segment: rounded bar with an outline. */
export const limb = (g: Graphics, a: Vector2, b: Vector2, width: number, color: number) => {
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: width + OUTLINE_W, color: OUTLINE, cap: 'round' });
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width, color, cap: 'round' });
};

/** A filled outlined polygon. The outline goes underneath so the fill keeps its full size. */
export const plate = (g: Graphics, points: Vector2[], color: number) => {
    g.poly(flat(points)).stroke({ width: OUTLINE_W, color: OUTLINE, join: 'round' });
    g.poly(flat(points)).fill(color);
};

export const dot = (g: Graphics, p: Vector2, r: number, color: number) => {
    g.circle(p.x, p.y, r + OUTLINE_W / 2).fill(OUTLINE);
    g.circle(p.x, p.y, r).fill(color);
};

export const hand = (g: Graphics, p: Vector2) => dot(g, p, 2.3, GLOVE);

export const boot = (g: Graphics, ankle: Vector2, color: number) => {
    g.roundRect(ankle.x - 2.8, ankle.y - 1.6, 8, 4, 1.6).stroke({ width: OUTLINE_W, color: OUTLINE });
    g.roundRect(ankle.x - 2.8, ankle.y - 1.6, 8, 4, 1.6).fill(color);
};

export const drawFlame = (g: Graphics, pose: FighterPose, flicker: number) => {
    const base = upperPoint(pose, -8.75, -1);
    const len = 10 + flicker * 5;
    const tipX = base.x - pose.lean * len;
    g.poly([base.x - 3, base.y, tipX, base.y + len, base.x + 3, base.y]).fill(0xff8a1e);
    g.poly([base.x - 1.6, base.y, base.x - pose.lean * len * 0.6, base.y + len * 0.6, base.x + 1.6, base.y]).fill(0xffe27a);
};

export const drawJetpack = (g: Graphics, pose: FighterPose, look: FighterLook) => {
    const U = (x: number, y: number) => upperPoint(pose, x, y);
    plate(g, [U(-12.5, -17), U(-5, -18), U(-5, -3), U(-12.5, -3)], look.jet);
    plate(g, [U(-11.5, -3), U(-6, -3), U(-6.5, -0.5), U(-11, -0.5)], GLOVE);
    plate(g, [U(-12.5, -12), U(-5, -12.5), U(-5, -10), U(-12.5, -9.5)], HAZARD);
};

export const drawTorso = (g: Graphics, pose: FighterPose, look: FighterLook) => {
    const U = (x: number, y: number) => upperPoint(pose, x, y);
    plate(g, [U(-6.2, 0.5), U(6.2, 0.5), U(7.6, -19.5), U(-6.6, -20)], look.torso);
    g.poly(flat([U(-6.2, 0.5), U(-1.5, 0.5), U(-2.4, -20), U(-6.6, -20)])).fill(shade(look.torso, 0.78));
    const a = U(1.5, -17.5), b = U(6, -17.8);
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 1.2, color: shade(look.torso, 1.35), cap: 'round' });
    if (look.style === 'robot') plate(g, [U(-6.4, -12), U(7, -12.2), U(7.1, -9), U(-6.3, -8.8)], look.accent);
    plate(g, [U(-6.4, -1.8), U(6.4, -1.8), U(6.3, 1.6), U(-6.3, 1.6)], BELT);
    plate(g, [U(2, -1.2), U(4.6, -1.2), U(4.6, 1), U(2, 1)], HAZARD);
};

/** Beasts and aliens have a tail that swings with the run cycle. */
export const drawTail = (g: Graphics, pose: FighterPose, look: FighterLook, swing: number) => {
    if (look.style !== 'beast' && look.style !== 'alien') return;
    const root = upperPoint(pose, -6, -1);
    const tip = { x: root.x - 9, y: root.y + 3 + swing * 3 };
    limb(g, root, tip, 3, look.accent);
};

/** Head drawn around its own origin; the view positions and tilts it. */
export const drawHead = (g: Graphics, look: FighterLook) => {
    if (look.style === 'robot') {
        g.moveTo(1, -6.5).lineTo(1, -10.5).stroke({ width: 1.6 + OUTLINE_W, color: OUTLINE, cap: 'round' });
        g.moveTo(1, -6.5).lineTo(1, -10.5).stroke({ width: 1.6, color: look.accent, cap: 'round' });
        g.roundRect(-6, -6.5, 13, 12, 2.5).stroke({ width: OUTLINE_W, color: OUTLINE });
        g.roundRect(-6, -6.5, 13, 12, 2.5).fill(look.head);
        g.roundRect(-1, -3, 8, 4.5, 1.5).fill(look.accent);
        return;
    }
    if (look.style === 'beast') {
        plate(g, [{ x: -5.5, y: -3 }, { x: -3.5, y: -11 }, { x: -0.5, y: -5 }], look.head);
        plate(g, [{ x: 0.5, y: -5.5 }, { x: 3.5, y: -11.5 }, { x: 5, y: -3.5 }], look.head);
    }
    if (look.style === 'alien') {
        limb(g, { x: -1, y: -6 }, { x: -4, y: -12 }, 1.2, look.head);
        limb(g, { x: 2, y: -6 }, { x: 4, y: -12.5 }, 1.2, look.head);
        dot(g, { x: -4, y: -12 }, 1.6, look.accent);
        dot(g, { x: 4, y: -12.5 }, 1.6, look.accent);
    }
    dot(g, { x: 0, y: 0 }, 7, look.head);
    g.moveTo(0, 0).arc(0, 0, 7, Math.PI * 0.55, Math.PI * 1.25).closePath().fill(shade(look.head, 0.75));
    g.roundRect(1, -3, 7.4, 5.4, 2.4).fill(VISOR);
    const glint = look.style === 'human' ? VISOR_GLINT : look.accent;
    g.moveTo(2.6, -1.8).lineTo(7, -1.8).stroke({ width: 1, color: glint, cap: 'round' });
};
