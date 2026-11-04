// Glass panel art (baked once per damage stage, see coverTextures): a tall pane between two metal
// rails with reflections and a hazard band; impact stars at stage 1, a big web and a broken top
// edge at stage 2, rails and a drift of shards at 3.

import { rnd } from '../scene/canvasKit';
import { COVER_SPECS, CoverStage } from '../../cover/coverTypes';
import { Ctx, Pt, Rand, contact, hazardStripe, lin, poly, radialCracks, rivets, softGlow } from './coverArtKit';

const GLASS_EDGE = 'rgba(205,243,255,.9)';
const CRACK_DARK = 'rgba(0,30,45,.45)';
const CRACK_LIT = 'rgba(245,253,255,.95)';

/** A metal rail across the pane's top or bottom, w wide and h tall, centred on cx. */
const rail = (c: Ctx, cx: number, y: number, w: number, h: number) => {
    c.fillStyle = lin(c, 0, y, 0, y + h, [[0, '#59626d'], [1, '#22272e']]); c.fillRect(cx - w / 2, y, w, h);
    c.fillStyle = lin(c, cx - w / 2, 0, cx + w / 2, 0, [[0, '#b9c6d5'], [1, '#5b6776']]); c.fillRect(cx - w / 2, y, w, 1.4);
    c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(cx + w / 2 - 1, y, 1, h);
    rivets(c, cx - w / 2 + 3.5, cx + w / 2, y + h / 2 + 0.3, w - 7, 0.8);
};

const glassDebris = (c: Ctx, cx: number, fy: number, R: Rand) => {
    contact(c, cx, fy, 20);
    c.fillStyle = 'rgba(160,225,250,.55)';
    const stump: Pt[] = [[cx - 8, fy - 7]];
    for (let i = 0; i <= 6; i++) stump.push([cx - 8 + i * 2.67, fy - 9 - R() * 14]);
    stump.push([cx + 8, fy - 7]);
    poly(c, stump); c.fill(); c.strokeStyle = 'rgba(225,250,255,.9)'; c.lineWidth = 0.6; c.stroke();
    rail(c, cx, fy - 7, 28, 7);
    c.save(); c.translate(cx + 28, fy - 3); c.rotate(0.05); contact(c, 0, 3, 18); rail(c, 0, -3, 28, 6); c.restore(); // the fallen top rail
    for (let i = 0; i < 22; i++) {
        const px = cx + (R() - 0.5) * 100, s = 1.5 + R() * 3.8;
        c.fillStyle = `rgba(175,232,255,${0.4 + R() * 0.5})`;
        poly(c, [[px, fy], [px + s, fy], [px + s * (R() - 0.2), fy - s * (0.5 + R())]]); c.fill();
    }
    for (let i = 0; i < 6; i++) softGlow(c, cx + (R() - 0.5) * 90, fy - 1.5, 2.4, 'rgba(255,255,255,.95)', 1, 'lighter'); // glints
};

/** The pane outline: a plain rectangle, or with the top-left corner broken away at stage 2. */
const paneShape = (x: number, w: number, top: number, fy: number, stage: CoverStage): Pt[] =>
    stage >= 2
        ? [[x, fy - 7], [x + w, fy - 7], [x + w, top + 6], [x + 7, top + 6], [x + 3, top + 20], [x + 5, top + 27], [x, top + 31]]
        : [[x, fy - 7], [x + w, fy - 7], [x + w, top + 6], [x, top + 6]];

/** Stage 1: two impact stars. Stage 2: a web of cracks from the middle and a spray of loose shards. */
const damage = (c: Ctx, cx: number, x: number, w: number, top: number, R: Rand, stage: CoverStage) => {
    if (stage >= 1) {
        [[cx - 2, top + 58], [cx + 3, top + 36]].forEach(([hx, hy]) => {
            radialCracks(c, hx, hy, 7, 9, R, CRACK_DARK, CRACK_LIT);
            c.strokeStyle = 'rgba(245,253,255,.9)'; c.lineWidth = 0.6; c.beginPath(); c.arc(hx, hy, 3, 0, Math.PI * 2); c.stroke();
            softGlow(c, hx, hy, 2.5, 'rgba(255,255,255,1)', 1, 'lighter');
        });
    }
    if (stage < 2) return;
    const ox = cx, oy = top + 50;
    radialCracks(c, ox, oy, 10, 62, R, CRACK_DARK, 'rgba(245,253,255,.9)');
    [6, 13, 23, 34].forEach(r => {
        c.strokeStyle = 'rgba(245,253,255,.75)'; c.lineWidth = 0.6; c.beginPath();
        for (let i = 0; i <= 10; i++) {
            const a = (i / 10) * Math.PI * 2, rr = r * (0.8 + R() * 0.4);
            if (i) c.lineTo(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr);
            else c.moveTo(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr);
        }
        c.stroke();
    });
    c.fillStyle = 'rgba(230,250,255,.18)'; poly(c, [[ox, oy], [x + w, oy - 14], [x + w, oy + 6]]); c.fill();
};

/** Draw a glass panel standing at (cx, fy): centre of its feet line. */
export const drawGlass = (c: Ctx, cx: number, fy: number, stage: CoverStage, seed: number) => {
    const R = rnd(seed), { w, h } = COVER_SPECS.glass, x = cx - w / 2, top = fy - h;
    if (stage === 3) return glassDebris(c, cx, fy, R);
    contact(c, cx, fy, 22);
    c.save();
    const shape = paneShape(x, w, top, fy, stage);
    poly(c, shape);
    c.fillStyle = lin(c, x, 0, x + w, 0, [[0, 'rgba(120,200,240,.30)'], [0.5, 'rgba(165,225,250,.20)'], [1, 'rgba(100,180,230,.34)']]); c.fill();
    c.save(); poly(c, shape); c.clip();
    // Two diagonal reflections, a warm light line and the hazard band
    [[top + 18, 14, 0.32], [top + 46, 6, 0.2]].forEach(([yy, bw, a]) => {
        c.fillStyle = lin(c, x, yy + 12, x + w, yy, [[0, 'rgba(255,255,255,0)'], [0.5, `rgba(255,255,255,${a})`], [1, 'rgba(255,255,255,0)']]);
        poly(c, [[x, yy + 14], [x + w, yy], [x + w, yy + bw], [x, yy + 14 + bw]]); c.fill();
    });
    c.fillStyle = 'rgba(255,210,140,.25)'; c.fillRect(x, top + 62, w, 0.8);
    hazardStripe(c, x, fy - 30, w, 3.2, seed, 6);
    c.fillStyle = 'rgba(255,255,255,.35)';
    for (let i = 0; i < 8; i++) c.fillRect(x + R() * w, top + 8 + R() * (h - 16), 0.6, 0.6);
    damage(c, cx, x, w, top, R, stage);
    c.restore();
    c.strokeStyle = GLASS_EDGE; c.lineWidth = 1; poly(c, shape); c.stroke();
    c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(x + w - 1.6, top + 6, 1.6, h - 13);
    rail(c, cx, top, 28, 6); rail(c, cx, fy - 7, 28, 7);
    if (stage >= 2) {
        for (let i = 0; i < 7; i++) {
            const px = cx + (R() - 0.5) * 36;
            c.fillStyle = 'rgba(175,232,255,.85)'; poly(c, [[px, fy], [px + 3, fy], [px + 1, fy - 3]]); c.fill();
        }
    }
    c.restore();
};
