// Tails: cat, tentacle, lizard and mechanical. Drawn on the body layer behind the flame and the jetpack, so the
// root tucks under the pack; the shape bends with the part motion springs (see tailChain.ts).

import { Graphics } from 'pixi.js';
import { Vector2 } from '../../../../types';
import { FighterPose, upperPoint } from '../fighterPose';
import { FighterLook, shade } from '../fighterLook';
import { GLOVE, WHITE, dot, flat, outlinedPoly } from '../fighterPaint';
import { roundRectPoints } from '../fighterDetails';
import { plate } from '../fighterParts';
import { PartMotionFrame } from './partMotionFrame';
import { tailPoints } from './tailChain';
import { lineLight, outlinedLine, sideLine, smoothLine, strokeLine, upperNormal } from './tailLine';

export { tailPoints } from './tailChain';

export const TAIL_ROOT = { x: -6, y: -1 };  // in the upper-body frame, just under the jetpack
const CAT_W = 2.8;
const CAT_TIP = 0.82;           // the cat tail's pale tip starts here along the line
const TENTACLE_W = 2;
const LIZARD = { root: 2.6, tip: 0.35, spikes: [0.2, 0.37, 0.54, 0.71], spike: 3.1 };
const LINK = { long: 4.6, wide: 3.3, r: 1.3 };
const METAL = 0x94a3b8;          // light metal links, as in the approved mockup (dark GLOVE links vanish on dark maps)
const GLOW_ALPHA = 0.28;

/** Mix a colour towards a pale grey. */
const pale = (c: number, t: number) => {
    const ch = (s: number) => Math.round(((c >> s) & 255) * (1 - t) + ((0xf1f5f9 >> s) & 255) * t);
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/** A light with a soft glow and a glint, for the tentacle and mech tips. */
const tipLight = (g: Graphics, p: Vector2, r: number, color: number) => {
    g.circle(p.x, p.y, r * 1.9).fill({ color, alpha: GLOW_ALPHA });
    dot(g, p, r, pale(color, 0.35));
    g.circle(p.x - r * 0.35, p.y - r * 0.35, r * 0.35).fill({ color: WHITE, alpha: 0.7 });
};

const drawCat = (g: Graphics, line: Vector2[], color: number) => {
    outlinedLine(g, line, CAT_W, color);
    strokeLine(g, line.slice(Math.floor(line.length * CAT_TIP)), CAT_W, pale(color, 0.6));
    lineLight(g, line, CAT_W);
};

const drawTentacle = (g: Graphics, line: Vector2[], look: FighterLook) => {
    outlinedLine(g, line, TENTACLE_W, look.pattern);
    lineLight(g, line, TENTACLE_W);
    const under = sideLine(line, () => -TENTACLE_W * 0.22);
    for (let i = 3; i < line.length - 3; i += 4) g.circle(under[i].x, under[i].y, 0.42).fill(shade(look.pattern, 0.55));
    tipLight(g, line[line.length - 1], 1.4, look.visor);
};

const drawLizard = (g: Graphics, line: Vector2[], look: FighterLook) => {
    const last = line.length - 1;
    const half = (i: number) => LIZARD.tip + (LIZARD.root - LIZARD.tip) * Math.pow(1 - i / last, 0.85);
    const top = sideLine(line, half), bottom = sideLine(line, i => -half(i));
    // Spikes first, so the body covers their feet
    for (const at of LIZARD.spikes) {
        const i = Math.round(at * last), n = upperNormal(line, i), h = LIZARD.spike * (1 - 0.45 * at);
        const back = top[Math.min(last, i + 2)], fore = top[Math.max(0, i - 2)];
        const dx = back.x - fore.x, dy = back.y - fore.y, len = Math.hypot(dx, dy) || 1;
        const apex = { x: top[i].x + n.x * h + dx / len * h * 0.35, y: top[i].y + n.y * h + dy / len * h * 0.35 };
        outlinedPoly(g, [fore, apex, back], look.visor);
    }
    const body = [...top, ...bottom.reverse()];
    outlinedPoly(g, body, look.pattern);
    g.poly(flat([...line, ...bottom])).fill(shade(look.pattern, 0.78)); // the shaded underside
    strokeLine(g, sideLine(line, i => half(i) * 0.55).slice(1, Math.ceil(last * 0.8)), 0.8, WHITE, 0.25);
};

/** A link plate centred between a and b, long side along the chain. */
const linkPlate = (a: Vector2, b: Vector2): Vector2[] => {
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, ang = Math.atan2(b.y - a.y, b.x - a.x);
    const c = Math.cos(ang), s = Math.sin(ang);
    return roundRectPoints(-LINK.long / 2, -LINK.wide / 2, LINK.long, LINK.wide, LINK.r, 3)
        .map(p => ({ x: cx + p.x * c - p.y * s, y: cy + p.x * s + p.y * c }));
};

const drawMech = (g: Graphics, pts: Vector2[], look: FighterLook) => {
    for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        plate(g, linkPlate(a, b), shade(METAL, i % 2 ? 0.85 : 1));
        g.circle((a.x + b.x) / 2, (a.y + b.y) / 2, 0.65).fill(GLOVE); // the dark rivet of the link
    }
    const a = pts[pts.length - 2], b = pts[pts.length - 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const bulb = { x: b.x + (b.x - a.x) / len * 1.2, y: b.y + (b.y - a.y) / len * 1.2 };
    tipLight(g, bulb, 1.6, look.visor);
};

/** The fighter's tail, if the build has one, bent by the part motion. */
export const drawTail = (g: Graphics, pose: FighterPose, look: FighterLook, m: PartMotionFrame) => {
    const tail = look.build.tail;
    if (tail === 'none') return;
    const pts = tailPoints(tail, upperPoint(pose, TAIL_ROOT.x, TAIL_ROOT.y), m);
    switch (tail) {
        case 'cat': drawCat(g, smoothLine(pts), look.pattern); return;
        case 'tentacle': drawTentacle(g, smoothLine(pts), look); return;
        case 'lizard': drawLizard(g, smoothLine(pts), look); return;
        case 'mech': drawMech(g, pts, look); return;
    }
};
