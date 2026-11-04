// Metal crate art (baked once per damage stage, see coverTextures): ribbed steel panel in a frame,
// stencilled number and hazard strip; dents at stage 1, a torn hole with a glowing edge at stage 2,
// a pile of plates at 3.

import { rnd } from '../scene/canvasKit';
import { COVER_SPECS, CoverStage } from '../../cover/coverTypes';
import { Ctx, Rand, bevel, contact, dent, hazardStripe, jaggedPts, lin, poly, rivets, softGlow, stencilCentered, streaks } from './coverArtKit';

const SHEET_EDGE = 'rgba(220,228,236,.6)';

const metalDebris = (c: Ctx, cx: number, fy: number, R: Rand) => {
    softGlow(c, cx, fy, 66, 'rgba(0,0,0,.6)', 0.2);
    softGlow(c, cx, fy - 18, 46, 'rgba(0,0,0,.3)');
    // The low pile of crumpled plate
    const pile: [number, number][] = [[cx - 26, fy]];
    for (let i = 0; i <= 7; i++) pile.push([cx - 26 + i * 7.4, fy - 4 - R() * 8]);
    pile.push([cx + 26, fy]);
    c.save(); poly(c, pile); c.clip();
    c.fillStyle = lin(c, 0, fy - 12, 0, fy, [[0, '#59636f'], [1, '#2b3038']]); c.fillRect(cx - 26, fy - 12, 52, 12);
    c.restore();
    c.strokeStyle = SHEET_EDGE; c.lineWidth = 0.6; c.beginPath();
    pile.slice(1, -1).forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
    c.stroke();
    for (let i = 0; i < 7; i++) {
        const px = cx + (R() - 0.5) * 104, s = 7 + R() * 9;
        c.save(); c.translate(px, fy - 3); c.rotate((R() - 0.5) * 0.45); contact(c, 0, 3, s * 1.2);
        const shape: [number, number][] = [[-s, 2.5], [s * 0.8, 3], [s, -2 - R() * 4], [-s * 0.3, -4 - R() * 5]];
        poly(c, shape); c.fillStyle = lin(c, 0, -8, 0, 3, [[0, '#7b8694'], [1, '#353c45']]); c.fill();
        c.strokeStyle = 'rgba(225,232,240,.6)'; c.lineWidth = 0.7;
        c.beginPath(); c.moveTo(...shape[3]); c.lineTo(...shape[2]); c.stroke();
        c.restore();
    }
    c.save(); c.translate(cx + 22, fy - 2.5); c.rotate(-0.22); hazardStripe(c, -11, -3, 22, 5.5, 8, 9); c.restore();
    c.save(); c.translate(cx - 32, fy - 2); c.rotate(0.1);
    c.fillStyle = lin(c, 0, -2, 0, 2, [[0, '#8d98a6'], [1, '#3e4651']]); c.fillRect(-11, -2.2, 23, 4.4);
    c.restore();
    for (let i = 0; i < 7; i++) softGlow(c, cx + (R() - 0.5) * 64, fy - 2 - R() * 7, 2.5 + R() * 2, 'rgba(255,150,60,.9)', 1, 'lighter'); // embers
    for (let i = 0; i < 3; i++) softGlow(c, cx + (i - 1) * 6 + R() * 4, fy - 20 - i * 16, 14 + i * 6, 'rgba(120,124,130,.3)'); // smoke
};

/** The panel face: ribs, number plate, hazard strip, frame, corner plates and edge scratches. */
const intact = (c: Ctx, cx: number, x: number, y: number, w: number, h: number, seed: number, R: Rand) => {
    c.fillStyle = lin(c, x, y, x, y + h, [[0, '#7c8795'], [0.5, '#525b67'], [1, '#353c45']]); c.fillRect(x, y, w, h);
    streaks(c, x, y, w, h, seed + 2, 0.45, false, 'overlay');
    const px = x + 6, py = y + 6, pw = w - 12, ph = h - 17;
    c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(px, py, pw, ph);
    bevel(c, px, py, pw, ph, 'rgba(0,0,0,.5)', 'rgba(220,230,240,.25)', 1);
    for (let i = 0; i < 4; i++) {
        const rx = px + 3 + i * 9.6;
        c.fillStyle = lin(c, rx, 0, rx + 6, 0, [[0, '#a3aebb'], [0.4, '#7a8592'], [1, '#3c444e']]); c.fillRect(rx, py + 2, 6, ph - 4);
        c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(rx + 6, py + 2, 1, ph - 4);
    }
    c.fillStyle = 'rgba(20,24,28,.75)'; c.fillRect(cx - 9, y + 15, 18, 11);
    stencilCentered(c, '07', cx, y + 24.5, 10, '#e8e4da', 0.85);
    hazardStripe(c, x + 3, y + h - 10, w - 6, 7, seed, 10);
    c.strokeStyle = '#1c2026'; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, w - 2, h - 2);
    c.fillStyle = lin(c, x, 0, x + w, 0, [[0, '#b9c6d5'], [0.35, '#8a97a7'], [1, '#5b6776']]); c.fillRect(x, y, w, 2.2);
    c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(x, y, 1.4, h);
    c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(x + w - 1.6, y, 1.6, h);
    [[x, y], [x + w - 8, y], [x, y + h - 8], [x + w - 8, y + h - 8]].forEach(([qx, qy]) => {
        c.fillStyle = lin(c, qx, qy, qx + 8, qy + 8, [[0, '#59626d'], [1, '#22272e']]); c.fillRect(qx, qy, 8, 8);
        bevel(c, qx, qy, 8, 8, 'rgba(255,255,255,.3)', 'rgba(0,0,0,.6)', 0.8);
        rivets(c, qx + 4, qx + 5, qy + 4, 10, 1);
    });
    c.strokeStyle = 'rgba(210,220,230,.55)'; c.lineWidth = 0.6;
    for (let i = 0; i < 9; i++) {
        const ex = x + R() * w, ey = R() < 0.5 ? y + 2 + R() * 3 : y + h - 11 - R() * 2;
        c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex + 2 + R() * 4, ey + (R() - 0.5)); c.stroke();
    }
};

/** Stage 1: dents, bright scrape marks and scorching. */
const dented = (c: Ctx, x: number, y: number, R: Rand) => {
    dent(c, x + 20, y + 15, 4.6); dent(c, x + 34, y + 29, 3.6); dent(c, x + 9, y + 28, 3);
    for (let i = 0; i < 8; i++) {
        const sx = x + 7 + R() * 36, sy = y + 7 + R() * 24;
        softGlow(c, sx, sy, 1.8, 'rgba(255,255,255,.9)', 1, 'lighter');
        c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(sx - 0.4, sy - 0.4, 0.8, 0.8);
    }
    softGlow(c, x + 39, y + 14, 12, 'rgba(6,6,6,.55)');
};

/** Stage 2: a torn hole glowing from inside, a bent corner, sparks and smoke. */
const torn = (c: Ctx, cx: number, x: number, y: number, R: Rand) => {
    const hx = x + 25, hy = y + 18, hole = jaggedPts(hx, hy, 11, 5, 12, R);
    softGlow(c, hx, hy, 18, 'rgba(0,0,0,.5)');
    poly(c, hole); c.fillStyle = '#07090c'; c.fill();
    softGlow(c, hx + 1, hy + 2, 7, 'rgba(255,120,40,.55)', 1, 'lighter');
    hole.forEach(([qx, qy], i) => {
        if (i % 3) return;
        const a = Math.atan2(qy - hy, qx - hx), L = 5 + R() * 3;
        const spike: [number, number][] = [[qx, qy], [qx + Math.cos(a + 1.3) * 3.2, qy + Math.sin(a + 1.3) * 3.2], [qx + Math.cos(a) * L, qy + Math.sin(a) * L]];
        poly(c, spike); c.fillStyle = lin(c, qx, qy, spike[2][0], spike[2][1], [[0, '#cfd8e2'], [1, '#5b6776']]); c.fill();
    });
    c.strokeStyle = 'rgba(230,238,246,.85)'; c.lineWidth = 0.8; poly(c, hole); c.stroke();
    poly(c, [[x, y], [x + 14, y], [x, y + 12]]); c.fillStyle = lin(c, x, y, x + 7, y + 6, [[0, '#c3cdd8'], [1, '#6f7a88']]); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x + 14, y); c.lineTo(x, y + 12); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x + 6, y + 36); c.quadraticCurveTo(x + 20, y + 31, x + 32, y + 37); c.stroke();
    for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (R() - 0.5) * 2.4, sx = hx + Math.cos(a) * 8, sy = hy + Math.sin(a) * 8, L = 3 + R() * 5;
        c.strokeStyle = '#ffc26a'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(a) * L, sy + Math.sin(a) * L); c.stroke();
    }
    softGlow(c, cx + 4, y - 10, 18, 'rgba(120,124,130,.34)');
};

/** Draw a metal crate standing at (cx, fy): centre of its feet line. */
export const drawMetal = (c: Ctx, cx: number, fy: number, stage: CoverStage, seed: number) => {
    const R = rnd(seed), { w, h } = COVER_SPECS.metal, x = cx - w / 2, y = fy - h;
    if (stage === 3) return metalDebris(c, cx, fy, R);
    contact(c, cx, fy, 38);
    c.save();
    intact(c, cx, x, y, w, h, seed, R);
    if (stage >= 1) dented(c, x, y, R);
    if (stage >= 2) torn(c, cx, x, y, R);
    c.restore();
};
