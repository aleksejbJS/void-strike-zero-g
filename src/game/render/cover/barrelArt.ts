// Explosive barrel art. The baked picture (drawBarrel) shows a red drum with hoops, a fuel label and a
// hazard diamond; dents and a leak at stage 1, a split seam at stage 2, a scorched wreck at stage 3.
// A badly damaged barrel also vents: that heat glow and fire jet flicker, so they are drawn live
// (barrelVent) over the baked picture.

import type { Graphics } from 'pixi.js';
import { rnd } from '../scene/canvasKit';
import { COVER_SPECS, CoverStage } from '../../cover/coverTypes';
import { Ctx, Pt, Rand, contact, dent, jaggedPts, lin, poly, softGlow, stencilCentered } from './coverArtKit';

const CYL = [[0, '#4e0e08'], [0.18, '#9c2a1c'], [0.36, '#d8442f'], [0.46, '#f07a62'], [0.56, '#cc3b28'], [0.8, '#8a2316'], [1, '#420b06']] as const;

const barrelBody = (c: Ctx, x: number, y: number, w: number, h: number) => {
    c.fillStyle = lin(c, x, 0, x + w, 0, CYL);
    c.beginPath(); c.roundRect(x, y, w, h, 3); c.fill();
};

const hoop = (c: Ctx, x: number, y: number, w: number) => {
    c.fillStyle = lin(c, x, 0, x + w, 0, [[0, '#2f0805'], [0.4, '#a5321f'], [0.5, '#e0715a'], [1, '#2f0805']]);
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + w / 2, y + 2.4, x + w, y); c.lineTo(x + w, y + 3.4); c.quadraticCurveTo(x + w / 2, y + 5.8, x, y + 3.4); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,190,170,.45)'; c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + w / 2, y + 2.4, x + w, y); c.stroke();
};

const barrelDebris = (c: Ctx, cx: number, fy: number, R: Rand) => {
    softGlow(c, cx, fy, 86, 'rgba(0,0,0,.8)', 0.2);
    softGlow(c, cx, fy - 32, 64, 'rgba(0,0,0,.45)');
    // The lower part of the drum, split open along the top
    const x = cx - 16, rim: Pt[] = [[x, fy]];
    for (let i = 0; i <= 8; i++) rim.push([x + i * 4, fy - 5 - R() * 11]);
    rim.push([x + 32, fy]);
    c.save(); poly(c, rim); c.clip();
    barrelBody(c, x, fy - 17, 32, 17);
    c.fillStyle = 'rgba(10,4,2,.45)'; c.fillRect(x, fy - 17, 32, 17);
    hoop(c, x, fy - 5, 32);
    c.restore();
    c.strokeStyle = 'rgba(255,170,90,.7)'; c.lineWidth = 0.6; c.beginPath();
    rim.slice(1, -1).forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
    c.stroke();
    // Torn-off curls of the shell on either side
    ([[x, -1], [x + 32, 1]] as const).forEach(([bx, s]) => {
        poly(c, [[bx, fy - 7], [bx + s * 10, fy - 14], [bx + s * 8, fy - 3]]);
        c.fillStyle = lin(c, bx, 0, bx + s * 10, 0, [[0, '#8e2418'], [1, '#3a0905']]); c.fill();
    });
    for (let i = 0; i < 8; i++) softGlow(c, cx + (R() - 0.5) * 84, fy - 1.5 - R() * 3, 2 + R() * 2, 'rgba(255,140,50,.95)', 1, 'lighter'); // embers
    for (let i = 0; i < 3; i++) softGlow(c, cx + (i - 1) * 5 + R() * 5, fy - 24 - i * 18, 16 + i * 7, 'rgba(95,95,100,.34)'); // smoke
};

/** The lid, the hazard diamond with its flame, and the stencilled label. */
const furniture = (c: Ctx, cx: number, x: number, y: number) => {
    c.fillStyle = '#3a0905'; c.beginPath(); c.ellipse(cx, y + 1.8, 16, 3.2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = lin(c, x, 0, x + 32, 0, [[0, '#6a140d'], [0.45, '#b9442f'], [1, '#5a110a']]);
    c.beginPath(); c.ellipse(cx, y + 1.6, 13.5, 2.3, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2b3038'; c.beginPath(); c.ellipse(cx + 7, y + 1.4, 2.6, 1.1, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(cx + 5.5, y + 0.9, 1.4, 0.6);
    c.save(); c.translate(cx, y + 22.5); c.rotate(Math.PI / 4);
    c.fillStyle = '#e8b514'; c.fillRect(-6, -6, 12, 12);
    c.strokeStyle = '#16191d'; c.lineWidth = 0.8; c.strokeRect(-4.6, -4.6, 9.2, 9.2);
    c.restore();
    c.fillStyle = '#16191d'; c.beginPath(); c.moveTo(cx, y + 17.8);
    c.bezierCurveTo(cx + 3.4, y + 21, cx + 2.6, y + 26, cx, y + 26.2);
    c.bezierCurveTo(cx - 2.6, y + 26, cx - 3.2, y + 22, cx - 0.6, y + 20.4);
    c.bezierCurveTo(cx - 0.4, y + 22, cx + 0.6, y + 22.6, cx, y + 17.8); c.fill();
    stencilCentered(c, 'FUEL', cx, y + 41, 6, '#f3e9dc', 0.7);
};

/** Stage 1: two dents and a thin leak running down to a puddle on the floor. */
const leaking = (c: Ctx, x: number, y: number, fy: number) => {
    dent(c, x + 8, y + 7, 3.4); dent(c, x + 23, y + 27, 2.8);
    c.fillStyle = '#140503'; c.beginPath(); c.arc(x + 26, y + 38, 1.4, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(25,8,4,.9)'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(x + 26, y + 39); c.quadraticCurveTo(x + 27, fy - 3, x + 28, fy); c.stroke();
    c.strokeStyle = 'rgba(255,210,170,.35)'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(x + 26.6, y + 40); c.quadraticCurveTo(x + 27.4, fy - 3, x + 28.3, fy - 0.6); c.stroke();
};

/** Stage 2: a ripped seam on the right side, glowing from inside; the jet itself is drawn live. */
const ripped = (c: Ctx, x: number, y: number, w: number, R: Rand) => {
    c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 0.8; c.beginPath();
    c.moveTo(x + w - 3, y + 21); c.lineTo(x + w - 9, y + 17); c.lineTo(x + w - 13, y + 19);
    c.moveTo(x + w - 3, y + 21); c.lineTo(x + w - 8, y + 26); c.stroke();
    poly(c, jaggedPts(x + w - 3, y + 21, 7, 1.8, 3.6, R)); c.fillStyle = '#140503'; c.fill();
    softGlow(c, x + w - 3, y + 21, 5, 'rgba(255,200,90,.9)', 1, 'lighter');
};

/** Draw an explosive barrel standing at (cx, fy): centre of its feet line. */
export const drawBarrel = (c: Ctx, cx: number, fy: number, stage: CoverStage, seed: number) => {
    const R = rnd(seed), { w, h } = COVER_SPECS.barrel, x = cx - w / 2, y = fy - h;
    if (stage === 3) return barrelDebris(c, cx, fy, R);
    contact(c, cx, fy, 26);
    c.save();
    if (stage >= 1) { // the puddle the leak forms
        c.fillStyle = lin(c, cx, 0, cx + 26, 0, [[0, 'rgba(25,8,4,.92)'], [1, 'rgba(25,8,4,.6)']]);
        c.beginPath(); c.ellipse(cx + 13, fy - 0.4, 14, 2.3, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,220,180,.35)'; c.fillRect(cx + 6, fy - 1.3, 10, 0.7);
    }
    barrelBody(c, x, y, w, h);
    c.fillStyle = '#3a0a06'; c.fillRect(x, y + h - 3, w, 3);
    hoop(c, x, y + 11, w); hoop(c, x, y + 31, w);
    c.save(); c.beginPath(); c.roundRect(x, y, w, h, 3); c.clip(); // chipped paint at the edges, a highlight down the middle
    for (let i = 0; i < 9; i++) {
        const ex = R() < 0.5 ? x + R() * 5 : x + w - 5 + R() * 5, ey = y + 4 + R() * (h - 8), s = 1 + R() * 2.6;
        c.fillStyle = '#80858c'; poly(c, [[ex, ey], [ex + s, ey + s * 0.3], [ex + s * 0.7, ey + s], [ex - s * 0.2, ey + s * 0.6]]); c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(x + w * 0.44, y + 3, 1.6, h - 6);
    c.restore();
    furniture(c, cx, x, y);
    if (stage >= 1) leaking(c, x, y, fy);
    if (stage >= 2) ripped(c, x, y, w, R);
    c.restore();
};

// --- live vent (Pixi) ---

const HEAT = 0xff4620;
const JET_SLICES = 8;
type Stop = readonly [at: number, r: number, g: number, b: number, a: number];
type Line = readonly [Pt, Pt];
/** Fire colour along the jet: white-yellow at the nozzle, orange, then red fading to nothing; and the hotter core inside it. */
const OUTER: readonly Stop[] = [[0, 255, 248, 200, 1], [0.3, 255, 176, 46, 0.95], [1, 255, 80, 20, 0]];
const CORE: readonly Stop[] = [[0, 255, 255, 255, 0.95], [1, 255, 220, 120, 0]];

/** The colour (0xRRGGBB) and alpha a stop list gives at fraction f of its length. */
const colorAt = (stops: readonly Stop[], f: number): { color: number; alpha: number } => {
    const hi = Math.max(1, stops.findIndex(s => s[0] >= f)), a = stops[hi - 1], b = stops[hi] ?? stops[stops.length - 1];
    const k = Math.min(1, Math.max(0, (f - a[0]) / (b[0] - a[0])));
    const mix = (i: 1 | 2 | 3 | 4) => a[i] + (b[i] - a[i]) * k;
    return { color: (Math.round(mix(1)) << 16) | (Math.round(mix(2)) << 8) | Math.round(mix(3)), alpha: mix(4) };
};

/** The jet between its two edge lines, in strips coloured by `stops`: Pixi has no cheap moving gradient. */
const jet = (g: Graphics, top: Line, bottom: Line, stops: readonly Stop[]) => {
    const at = (line: Line, f: number): Pt => [line[0][0] + (line[1][0] - line[0][0]) * f, line[0][1] + (line[1][1] - line[0][1]) * f];
    for (let i = 0; i < JET_SLICES; i++) {
        const f0 = i / JET_SLICES, f1 = (i + 1) / JET_SLICES;
        g.poly([...at(top, f0), ...at(top, f1), ...at(bottom, f1), ...at(bottom, f0)]).fill(colorAt(stops, (f0 + f1) / 2));
    }
};

/**
 * The live part of a venting barrel at (cx, fy): a flickering heat glow and a fire jet out of the seam,
 * `t` in seconds. Draws onto `g` (the caller clears it and sets its blend mode to 'add').
 */
export const barrelVent = (g: Graphics, cx: number, fy: number, t: number): void => {
    const x = cx - 16 + 32, y = fy - 46; // the right edge of the drum, top of the drum
    const glowR = 46 + Math.sin(t * 18) * 4;
    for (let i = 0; i < 5; i++) g.circle(cx, fy - 22, glowR * (1 - i * 0.2)).fill({ color: HEAT, alpha: 0.05 });
    const L = 22 + Math.sin(t * 31) * 4, wob = Math.sin(t * 22) * 2;
    jet(g, [[x - 2, y + 19.5], [x + L, y + 15.5 + wob]], [[x - 2, y + 22.8], [x + L, y + 27 + wob]], OUTER);
    jet(g, [[x - 1, y + 20.4], [x + L * 0.5, y + 19.6 + wob * 0.5]], [[x - 1, y + 22], [x + L * 0.5, y + 22.8 + wob * 0.5]], CORE);
};
