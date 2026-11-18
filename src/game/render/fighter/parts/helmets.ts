// Helmet shapes and the whole head drawing (helmet, visor, horns in front), around the head's origin.
// Ears that sit behind the head live on their own layer, see ears.ts.

import { Graphics } from 'pixi.js';
import { FighterLook, shade } from '../fighterLook';
import { HEAD_R, ROBOT_HEAD_K } from '../fighterStyle';
import { OUTLINE, OUTLINE_W, POUCH, WHITE, dot } from '../fighterPaint';
import { drawSpecular, plateHighlight } from '../fighterDetails';
import { plate } from '../fighterParts';
import { ANGULAR, DOME } from './headSpace';
import { drawVisor } from './visors';
import { drawFrontEars } from './ears';

/** The ridge line over the top of a helmet, around the head's origin. */
export const helmetRidge = (g: Graphics) => {
    const r = HEAD_R - 2.2, from = Math.PI * 1.15, to = Math.PI * 1.75;
    g.moveTo(r * Math.cos(from), r * Math.sin(from)).arc(0, 0, r, from, to).stroke({ width: 1.2, color: OUTLINE, cap: 'round' });
};

/** Identifies everything drawHead reads, so the view redraws the head only when one of these changes. */
export const headKeyOf = (look: FighterLook) => {
    const { helmet, visor, ears } = look.build;
    return `${helmet}:${visor}:${ears}:${look.head}:${look.visor}:${look.pattern}`;
};

/** A round shaded ball: the round helmet, or the face inside the dome. */
const ball = (g: Graphics, x: number, y: number, r: number, color: number) => {
    dot(g, { x, y }, r, color);
    g.moveTo(x, y).arc(x, y, r, Math.PI * 0.55, Math.PI * 1.25).closePath().fill(shade(color, 0.75));
};

const drawRound = (g: Graphics, look: FighterLook) => {
    ball(g, 0, 0, HEAD_R, look.head);
    drawSpecular(g, HEAD_R);
    if (look.build.ears === 'none') helmetRidge(g);
};

/** Today's robot head; its short antenna (in the pattern colour) makes way for any ears. */
const drawBox = (g: Graphics, look: FighterLook) => {
    const k = ROBOT_HEAD_K;
    if (look.build.ears === 'none') {
        g.moveTo(1 * k, -6.5 * k).lineTo(1 * k, -10.5 * k).stroke({ width: 1.6 + OUTLINE_W, color: OUTLINE, cap: 'round' });
        g.moveTo(1 * k, -6.5 * k).lineTo(1 * k, -10.5 * k).stroke({ width: 1.6, color: look.pattern, cap: 'round' });
    }
    g.roundRect(-6 * k, -6.5 * k, 13 * k, 12 * k, 2.5 * k).stroke({ width: OUTLINE_W, color: OUTLINE });
    g.roundRect(-6 * k, -6.5 * k, 13 * k, 12 * k, 2.5 * k).fill(look.head);
    const l = -6 * k + 1.5, r = 7 * k - 1.5, t = -6.5 * k, b = 5.5 * k; // the straight part of the box edges
    plateHighlight(g, [{ x: l, y: t }, { x: r, y: t }, { x: r, y: b }, { x: l, y: b }]);
};

/** Glass bubble and the simple face inside; the eye, glare and collar go on top after the visor (drawDomeGlass). */
const drawDome = (g: Graphics, look: FighterLook) => {
    const { bubble, face } = DOME;
    g.circle(bubble.x, bubble.y, bubble.r).stroke({ width: OUTLINE_W, color: OUTLINE });
    g.circle(bubble.x, bubble.y, bubble.r).fill({ color: DOME.glass, alpha: 0.25 });
    ball(g, face.x, face.y, face.r, look.head);
};

const drawDomeGlass = (g: Graphics) => {
    const { bubble, collar, face } = DOME;
    g.circle(face.x + 2.2, face.y - 0.9, 0.6).fill(WHITE); // the eye, shining through the visor
    const r = bubble.r * 0.76, from = Math.PI * 1.15, to = Math.PI * 1.48;
    g.moveTo(bubble.x + r * Math.cos(from), bubble.y + r * Math.sin(from)).arc(bubble.x, bubble.y, r, from, to)
        .stroke({ width: 1.1, color: WHITE, alpha: 0.7, cap: 'round' });
    g.circle(bubble.x, bubble.y, bubble.r - 0.9).stroke({ width: 0.6, color: WHITE, alpha: 0.18 });
    const gr = bubble.r * 0.72, ga = -Math.PI * 0.3;
    g.circle(bubble.x + gr * Math.cos(ga), bubble.y + gr * Math.sin(ga), 0.7).fill({ color: WHITE, alpha: 0.5 });
    const { x, y, w, h } = collar;
    plate(g, [{ x, y }, { x: x + w, y }, { x: x + w - 0.8, y: y + h }, { x: x + 0.8, y: y + h }], POUCH);
};

/** Faceted trooper helmet: a dark lower facet and a light upper one. */
const drawAngular = (g: Graphics, look: FighterLook) => {
    plate(g, ANGULAR, look.head);
    const [, top, front, , chin, back, nape] = ANGULAR;
    const mid = { x: 0, y: 2.87 };
    g.poly([nape, back, chin, mid].flatMap(p => [p.x, p.y])).fill({ color: 0x000000, alpha: 0.18 });
    g.poly([top, front, { x: 1.6, y: -3.6 }, { x: -2.5, y: -5.2 }].flatMap(p => [p.x, p.y])).fill({ color: WHITE, alpha: 0.12 });
};

/** Head drawn around its own origin; the view positions and tilts it. */
export const drawHead = (g: Graphics, look: FighterLook) => {
    const { helmet, visor } = look.build;
    if (helmet === 'none') { drawVisor(g, visor, helmet, look.visor); drawFrontEars(g, look); return; }
    if (helmet === 'round') drawRound(g, look);
    else if (helmet === 'box') drawBox(g, look);
    else if (helmet === 'dome') drawDome(g, look);
    else drawAngular(g, look);
    drawVisor(g, visor, helmet, look.visor);
    if (helmet === 'dome') drawDomeGlass(g);
    drawFrontEars(g, look);
};
