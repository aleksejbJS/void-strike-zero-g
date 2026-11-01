// Arena platform art: bright show plates with a lime neon edge (the zone's colour), a polished
// dark arena floor with markings, and dark pylons with a light strip. Top edges stay flat.

import { Platform } from '../../../../types';
import { glow, makeCanvas, overlayNoise, stencil } from '../canvasKit';
import { PlatformPiece } from '../stationPlatforms';

const MAX_CHUNK = 2048;
const GLOW = 22;
const LIME = '#a3e635';

const kindOf = (p: Platform) => (p.h > p.w ? 'pylon' : p.h >= 100 || p.w > 1200 ? 'floor' : 'plate');

const plate = (p: Platform, seed: number, res: number): PlatformPiece => {
    const { canvas, ctx } = makeCanvas(p.w, p.h + GLOW, res);
    // Neon glow spilling below the plate
    const ng = ctx.createLinearGradient(0, p.h, 0, p.h + GLOW);
    ng.addColorStop(0, 'rgba(163,230,53,0.35)'); ng.addColorStop(1, 'rgba(163,230,53,0)');
    ctx.fillStyle = ng; ctx.fillRect(0, p.h, p.w, GLOW);
    const g = ctx.createLinearGradient(0, 0, 0, p.h);
    g.addColorStop(0, '#dde2ea'); g.addColorStop(0.18, '#a3acba'); g.addColorStop(1, '#4b5361');
    ctx.fillStyle = g; ctx.fillRect(0, 0, p.w, p.h);
    for (let x = 80; x < p.w; x += 80) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(x, 4, 1.5, p.h - 6); }
    if (p.w >= 160) stencil(ctx, `A${(seed % 9) + 1}`, 10, p.h * 0.75, Math.min(16, p.h * 0.6), '#1d2330', 0.5);
    ctx.fillStyle = LIME; ctx.fillRect(0, p.h - 3, p.w, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(0, 0, p.w, 1.5);
    overlayNoise(ctx, 20, 100 + seed, 0.2);
    return { canvas, x: p.x, y: p.y };
};

const floorChunk = (x0: number, p: Platform, w: number, seed: number, res: number): PlatformPiece => {
    const { canvas, ctx } = makeCanvas(w, p.h, res);
    const g = ctx.createLinearGradient(0, 0, 0, p.h);
    g.addColorStop(0, '#1b2130'); g.addColorStop(0.12, '#0f131c'); g.addColorStop(1, '#05070b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, p.h);
    // Polished surface: a soft reflection band and floor markings
    ctx.fillStyle = 'rgba(160,190,255,0.06)'; ctx.fillRect(0, 10, w, 26);
    for (let x = 200 - (x0 % 200); x < w; x += 200) { ctx.fillStyle = 'rgba(163,230,53,0.25)'; ctx.fillRect(x, 0, 2, 40); }
    for (let x = 400 - (x0 % 400); x < w; x += 400) glow(ctx, x, 6, 60, '#a3e635', 0.08);
    ctx.fillStyle = LIME; ctx.fillRect(0, 0, w, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(0, 0, w, 1);
    for (let y = 60; y < p.h; y += 60) { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, y, w, 2); }
    overlayNoise(ctx, 40, 110 + seed, 0.35);
    return { canvas, x: p.x + x0, y: p.y };
};

const pylonChunk = (y0: number, p: Platform, h: number, seed: number, res: number): PlatformPiece => {
    const { canvas, ctx } = makeCanvas(p.w, h, res);
    const g = ctx.createLinearGradient(0, 0, p.w, 0);
    g.addColorStop(0, '#2a3242'); g.addColorStop(0.5, '#151a25'); g.addColorStop(1, '#0a0d14');
    ctx.fillStyle = g; ctx.fillRect(0, 0, p.w, h);
    ctx.fillStyle = LIME; ctx.globalAlpha = 0.7; ctx.fillRect(p.w * 0.5 - 1.5, 0, 3, h); ctx.globalAlpha = 1;
    for (let y = 160 - (y0 % 160); y < h; y += 160) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, y, p.w, 3); }
    overlayNoise(ctx, 40, 120 + seed, 0.35);
    return { canvas, x: p.x, y: p.y + y0 };
};

export const bakeArenaPlatform = (p: Platform, seed: number, res = 1): PlatformPiece[] => {
    const kind = kindOf(p);
    if (kind === 'plate') return [plate(p, seed, res)];
    const pieces: PlatformPiece[] = [];
    if (kind === 'floor') for (let x = 0; x < p.w; x += MAX_CHUNK) pieces.push(floorChunk(x, p, Math.min(MAX_CHUNK, p.w - x), seed + x, res));
    else for (let y = 0; y < p.h; y += MAX_CHUNK) pieces.push(pylonChunk(y, p, Math.min(MAX_CHUNK, p.h - y), seed + y, res));
    return pieces;
};
