// Ears, horns and antennae. Most sit behind the head on their own layer (drawEars, redrawn every frame so
// bunny ears can flop and the lamp can blink); the near ram horn curls in front and is part of the head.

import { Graphics } from 'pixi.js';
import { Vector2 } from '../../../../types';
import { FighterLook, shade } from '../fighterLook';
import { OUTLINE, OUTLINE_W, WHITE, dot, flat, outlinedPoly } from '../fighterPaint';
import { ellipsePoints } from '../fighterDetails';
import { limb, plate } from '../fighterParts';
import { HEAD_SPACE } from './headSpace';
import { PartMotionFrame } from './partMotionFrame';

const P = (x: number, y: number): Vector2 => ({ x, y });
const METAL = 0x94a3b8;
const BONE = 0xd6c7a1;
const BUNNY_PINK = 0xf9a8d4;
const FLOP = 0.5;     // radians the bunny ears tip back at full flop
const LAMP_DIM = 0.35;
const { at, k: K } = HEAD_SPACE; // ears stand on the full head on every helmet (on a dome, on the glass)
const map = (pts: Vector2[]) => pts.map(p => at(p.x, p.y));

/** Mix a colour towards a pale grey: the light inside of ears. */
const lighter = (c: number, t = 0.55) => {
    const ch = (s: number) => Math.round(((c >> s) & 255) * (1 - t) + ((0xf1f5f9 >> s) & 255) * t);
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/** The inside of a pointed ear [base, tip, base]: the ear shrunk towards a point a third of the way up. */
const innerOf = ([a, tip, b]: Vector2[], t = 0.55) => {
    const m = P((a.x + b.x) / 2 + (tip.x - (a.x + b.x) / 2) / 3, (a.y + b.y) / 2 + (tip.y - (a.y + b.y) / 2) / 3);
    return [a, tip, b].map(p => P(m.x + (p.x - m.x) * t, m.y + (p.y - m.y) * t));
};

const rotateAbout = (pts: Vector2[], pivot: Vector2, angle: number) => {
    const c = Math.cos(angle), s = Math.sin(angle);
    return pts.map(p => P(pivot.x + (p.x - pivot.x) * c - (p.y - pivot.y) * s, pivot.y + (p.x - pivot.x) * s + (p.y - pivot.y) * c));
};

// Shapes in design units (head radius 7 around the origin, face towards +x); back ear first.
const CAT = [[P(-5.5, -3), P(-3.5, -11), P(-0.5, -5)], [P(0.5, -5.5), P(3.5, -11.5), P(5, -3.5)]];
const WOLF = [[P(-5.35, -3.3), P(-6.6, -12.35), P(-1.25, -6.2)], [P(-0.4, -6.2), P(1.25, -13.6), P(4.1, -5.35)]];
const HORNS = [
    [P(-4.1, -5.35), P(-5.75, -8.65), P(-4.95, -11.5), P(-2.9, -7.8), P(-1.65, -6.2)],
    [P(0.8, -6.6), P(1.25, -9.9), P(3.7, -12.35), P(3.3, -8.65), P(3.3, -6.2)],
];
const CREST = [P(-7, 0), P(-8.65, -4.55), P(-5.35, -4.1), P(-6.2, -8.65), P(-2.9, -6.6), P(-2.05, -11.1), P(0, -7.4), P(2.05, -10.3), P(2.45, -6.2)];
const BUNNY = [{ x: -3.3, y: -10.3, rx: 1.8, ry: 5.35, rot: -0.31 }, { x: 1.65, y: -11.1, rx: 1.8, ry: 5.55, rot: 0.21 }];
const ROUND = [P(-5.35, -5.35), P(4.1, -6.2)];
const RAM = [P(-2.05, -5.75), P(-6.2, -9.05), P(-9.45, -4.55), P(-7, -1.65), P(-5.35, 0), P(-3.3, -1.65), P(-4.55, -3.3)]; // two Béziers

const drawBunny = (g: Graphics, color: number, flop: number) => {
    BUNNY.forEach((e, i) => {
        const base = P(e.x - e.ry * Math.sin(e.rot), e.y + e.ry * Math.cos(e.rot)); // the bottom of the ear
        const tip = (pts: Vector2[]) => map(rotateAbout(pts, base, -flop * FLOP));
        plate(g, tip(ellipsePoints(e.x, e.y, e.rx, e.ry, e.rot)), i === 0 ? shade(color, 0.85) : color);
        if (i === 1) g.poly(flat(tip(ellipsePoints(e.x + 0.1, e.y + 0.5, e.rx * 0.42, e.ry * 0.68, e.rot)))).fill(BUNNY_PINK);
    });
};

const drawLamp = (g: Graphics, color: number, on: boolean) => {
    limb(g, at(-0.4, -5), at(-0.4, -11.8), 1.3, METAL);
    const bulb = at(-0.4, -12.9), r = 1.5 * K;
    if (on) g.circle(bulb.x, bulb.y, r * 1.9).fill({ color, alpha: 0.25 });
    g.circle(bulb.x, bulb.y, r + OUTLINE_W / 2).fill(OUTLINE);
    g.circle(bulb.x, bulb.y, r).fill({ color, alpha: on ? 1 : LAMP_DIM });
    g.circle(bulb.x - r * 0.35, bulb.y - r * 0.35, r * 0.3).fill({ color: WHITE, alpha: on ? 0.8 : 0.3 });
};

/** The curled ram horn on the side of the head (design units), shifted by (dx, dy). */
const ramHorn = (g: Graphics, color: number, dx = 0, dy = 0) => {
    const [a, b, c, d, e, f, h] = map(RAM).map(p => P(p.x + dx * K, p.y + dy * K));
    const path = () => g.moveTo(a.x, a.y).bezierCurveTo(b.x, b.y, c.x, c.y, d.x, d.y).bezierCurveTo(e.x, e.y, f.x, f.y, h.x, h.y);
    const w = 1.65 * K;
    path().stroke({ width: w + OUTLINE_W, color: OUTLINE, cap: 'round', join: 'round' });
    path().stroke({ width: w, color, cap: 'round', join: 'round' });
    path().stroke({ width: w * 0.3, color: WHITE, alpha: 0.2, cap: 'round', join: 'round' });
};

/** Ears, horns or antennae behind the head; `m` makes bunny ears flop and the lamp blink. */
export const drawEars = (g: Graphics, look: FighterLook, m: PartMotionFrame) => {
    const head = look.head;
    switch (look.build.ears) {
        case 'none': return;
        case 'cat': CAT.forEach(e => plate(g, map(e), head)); return;
        case 'antennae': // today's alien antennae
            limb(g, at(-1, -6), at(-4, -12), 1.2, head);
            limb(g, at(2, -6), at(4, -12.5), 1.2, head);
            dot(g, at(-4, -12), 1.6, look.pattern);
            dot(g, at(4, -12.5), 1.6, look.pattern);
            return;
        case 'wolf': WOLF.forEach(e => {
            plate(g, map(e), head);
            g.poly(flat(map(innerOf(e)))).fill(lighter(head));
        }); return;
        case 'bunny': drawBunny(g, head, m.earFlop); return;
        case 'round': map(ROUND).forEach(p => {
            dot(g, p, 2.7 * K, head);
            g.circle(p.x, p.y, 1.25 * K).fill(lighter(head));
        }); return;
        case 'horns': HORNS.forEach(e => plate(g, map(e), look.pattern)); return;
        case 'ram': ramHorn(g, shade(BONE, 0.75), 1.4, -1.1); return; // the far horn peeks out behind the head
        case 'lamp': drawLamp(g, look.visor, m.lampOn); return;
        case 'crest': outlinedPoly(g, map(CREST), look.pattern); return;
    }
};

/** Parts that sit in front of the helmet: the near ram horn. Static, so it is drawn with the head. */
export const drawFrontEars = (g: Graphics, look: FighterLook) => {
    if (look.build.ears === 'ram') ramHorn(g, BONE);
};
