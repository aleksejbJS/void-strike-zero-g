// Wood crate art (baked once per damage stage, see coverTextures): planks, corner brackets, a
// stencilled label; cracks at stage 1, a hole and a hanging board at stage 2, a heap of planks at 3.

import { rnd } from '../scene/canvasKit';
import { COVER_SPECS, CoverStage } from '../../cover/coverTypes';
import { Ctx, Rand, bevel, contact, jaggedPts, lin, poly, rivets, softGlow, split, stencilCentered, streaks } from './coverArtKit';

const WOOD = ['#a8733e', '#9b6735', '#b27d46'];
const SPLINTER = '#e2b27c';

const board = (c: Ctx, x: number, y: number, w: number, h: number, col: string, seed: number, vertical = false) => {
    c.fillStyle = lin(c, x, y, vertical ? x + w : x, vertical ? y : y + h, [[0, col], [1, '#6e4521']]);
    c.fillRect(x, y, w, h);
    streaks(c, x, y, w, h, seed, 0.55, vertical, 'multiply');
    bevel(c, x, y, w, h, 'rgba(255,228,185,.35)', 'rgba(25,12,4,.55)', 0.8);
};

const woodDebris = (c: Ctx, cx: number, fy: number, R: Rand) => {
    softGlow(c, cx, fy - 10, 56, 'rgba(170,140,105,.22)', 0.55);
    contact(c, cx, fy, 40);
    // The low heap the crate collapsed into
    const heap: [number, number][] = [[cx - 25, fy]];
    for (let i = 0; i <= 8; i++) heap.push([cx - 25 + i * 6.25, fy - 3 - R() * 8]);
    heap.push([cx + 25, fy]);
    c.save(); poly(c, heap); c.clip(); board(c, cx - 25, fy - 12, 50, 12, '#8a5a2e', 3); c.restore();
    c.fillStyle = SPLINTER;
    for (let i = 1; i < heap.length - 1; i++) c.fillRect(heap[i][0] - 0.5, heap[i][1], 1, 1.2);
    // Loose planks lying about, then two leaning boards
    for (let i = 0; i < 10; i++) {
        const px = cx + (R() - 0.5) * 108, len = 9 + R() * 20, th = 3.5 + R() * 2.4;
        c.save(); c.translate(px, fy - th / 2); c.rotate((R() - 0.5) * 0.25);
        contact(c, 0, th / 2, len * 0.6);
        board(c, -len / 2, -th / 2, len, th, WOOD[i % 3], 10 + i);
        c.fillStyle = SPLINTER; poly(c, [[len / 2, -th / 2], [len / 2 + 3, -th / 4], [len / 2, th / 2]]); c.fill();
        c.restore();
    }
    for (let i = 0; i < 2; i++) {
        const px = cx + (i ? 14 : -18) + R() * 6, len = 20 + R() * 8;
        c.save(); c.translate(px, fy); c.rotate((i ? 1 : -1) * (0.45 + R() * 0.35));
        board(c, -2.7, -len, 5.4, len, WOOD[i], 30 + i, true);
        c.fillStyle = SPLINTER; poly(c, [[-2.7, -len], [2.7, -len], [0.5, -len - 5]]); c.fill();
        c.restore();
    }
    c.fillStyle = SPLINTER;
    for (let i = 0; i < 10; i++) {
        const px = cx + (R() - 0.5) * 96;
        poly(c, [[px, fy], [px + 3 + R() * 3, fy], [px + 1, fy - 2 - R() * 3]]); c.fill();
    }
};

const cornerBracket = (c: Ctx, bx: number, by: number, sx: number, sy: number) => {
    c.fillStyle = lin(c, bx, by, bx + sx * 9, by + sy * 9, [[0, '#9aa6b4'], [1, '#4a535e']]);
    poly(c, [[bx, by], [bx + sx * 10, by], [bx + sx * 10, by + sy * 2.6], [bx + sx * 2.6, by + sy * 2.6], [bx + sx * 2.6, by + sy * 10], [bx, by + sy * 10]]);
    c.fill();
    rivets(c, bx + sx * 5.5, bx + sx * 5.5 + 1, by + sy * 1.3, 10, 0.7);
};

/** Stage 1: knotholes, a chipped corner, splits along the grain. */
const cracked = (c: Ctx, x: number, y: number, w: number, h: number, R: Rand) => {
    [[x + 13, y + 14], [x + 35, y + 29], [x + 21, y + 34], [x + 41, y + 13]].forEach(([hx, hy]) => {
        c.fillStyle = '#e3b37c'; c.beginPath(); c.arc(hx, hy, 2.3, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#140b04'; c.beginPath(); c.arc(hx + 0.2, hy + 0.2, 1.4, 0, Math.PI * 2); c.fill();
    });
    c.fillStyle = '#1b1007';
    poly(c, [[x + w - 16, y], [x + w, y], [x + w, y + 13], [x + w - 5, y + 8], [x + w - 10, y + 5]]); c.fill();
    c.strokeStyle = '#e8b780'; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(x + w - 16, y); c.lineTo(x + w - 10, y + 5); c.lineTo(x + w - 5, y + 8); c.lineTo(x + w, y + 13); c.stroke();
    split(c, x + 14, y + 16, 18, R); split(c, x + 30, y + 30, 14, R); split(c, x + 9, y + 40, 12, R);
};

/** Stage 2: a hole through to the dark inside, a torn corner and a plank hanging off the top. */
const smashed = (c: Ctx, x: number, y: number, w: number, h: number, R: Rand, seed: number) => {
    const hole = jaggedPts(x + 28, y + 20, 12, 6, 13, R);
    c.save(); poly(c, hole); c.clip();
    c.fillStyle = lin(c, 0, y + 8, 0, y + 33, [[0, '#0d0703'], [1, '#2b190b']]); c.fillRect(x, y, w, h);
    c.fillStyle = 'rgba(120,75,35,.35)';
    for (let k = 0; k < 3; k++) c.fillRect(x, y + 11 + k * 8, w, 0.8);
    c.restore();
    c.fillStyle = SPLINTER;
    hole.forEach(([px, py], i) => {
        if (i % 2) return;
        const a = Math.atan2(py - (y + 20), px - (x + 28));
        poly(c, [[px, py], [px + Math.cos(a + 1.6) * 2.2, py + Math.sin(a + 1.6) * 2.2], [px - Math.cos(a) * 5, py - Math.sin(a) * 5]]); c.fill();
    });
    c.strokeStyle = 'rgba(232,183,128,.8)'; c.lineWidth = 0.8; poly(c, hole); c.stroke();
    split(c, x + 28, y + 20, 26, R, 0.3); split(c, x + 22, y + 26, 20, R, 0.3);
    c.fillStyle = '#160d06'; poly(c, [[x, y + h - 16], [x + 10, y + h - 11], [x + 14, y + h], [x, y + h]]); c.fill();
    c.strokeStyle = '#e8b780'; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(x, y + h - 16); c.lineTo(x + 10, y + h - 11); c.lineTo(x + 14, y + h); c.stroke();
    c.save(); c.translate(x + 7, y + 4); c.rotate(-0.4);
    c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 2; c.shadowOffsetY = 2;
    board(c, 0, -3, 23, 5.5, '#b27d46', seed + 60);
    c.shadowColor = 'transparent';
    c.fillStyle = SPLINTER; poly(c, [[23, -3], [27, -1], [23, 2.5]]); c.fill();
    c.restore();
};

/** Draw a wood crate standing at (cx, fy): centre of its feet line. */
export const drawWood = (c: Ctx, cx: number, fy: number, stage: CoverStage, seed: number) => {
    const R = rnd(seed), { w, h } = COVER_SPECS.wood, x = cx - w / 2, y = fy - h;
    if (stage === 3) return woodDebris(c, cx, fy, R);
    contact(c, cx, fy, 36);
    c.save();
    if (stage === 2) { c.translate(cx, fy); c.rotate(-0.03); c.translate(-cx, -fy); } // slumped
    c.fillStyle = '#24160a'; c.fillRect(x, y, w, h);
    for (let i = 0; i < 3; i++) board(c, x + 5, y + 5 + i * 12.4, w - 10, 11.6, WOOD[i], seed * 7 + i);
    // The diagonal brace
    c.save(); c.beginPath(); c.rect(x + 5, y + 5, w - 10, h - 10); c.clip();
    const len = Math.hypot(w - 10, h - 10) + 8;
    c.translate(cx, fy - h / 2); c.rotate(Math.atan2(-(h - 10), w - 10));
    c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 3; c.shadowOffsetY = 1.5;
    board(c, -len / 2, -4, len, 8, '#8f5d2f', seed + 40);
    c.restore();
    board(c, x, y, w, 5, '#87582c', seed + 50); board(c, x, y + h - 5, w, 5, '#7d5128', seed + 51);
    board(c, x, y + 5, 5, h - 10, '#84562b', seed + 52, true); board(c, x + w - 5, y + 5, 5, h - 10, '#7a4f27', seed + 53, true);
    [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([bx, by, sx, sy]) => cornerBracket(c, bx, by, sx, sy));
    stencilCentered(c, 'VS-ZG', cx, y + 30.5, 7, '#2a1708', 0.55);
    c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(x, y + h - 8, w, 8);
    if (stage >= 1) cracked(c, x, y, w, h, R);
    if (stage >= 2) smashed(c, x, y, w, h, R, seed);
    c.restore();
};
