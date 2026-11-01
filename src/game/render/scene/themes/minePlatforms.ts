// Mine platform art: rock slabs with a steel lip and glowing ore veins, bedrock floors with a
// rail track on top, rock pillars propped with timber. The walkable top edge stays exactly flat.

import { Platform } from '../../../../types';
import { bolts, makeCanvas, overlayNoise, rnd } from '../canvasKit';
import { PlatformPiece } from '../stationPlatforms';

const MAX_CHUNK = 2048;
const SHADOW = 36;

const kindOf = (p: Platform) => (p.h > p.w ? 'column' : p.h >= 100 || p.w > 1200 ? 'floor' : 'slab');

const rock = (ctx: CanvasRenderingContext2D, w: number, h: number, top: string, bottom: string) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    ctx.fillStyle = g;
};

const oreVeins = (ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) => {
    const r = rnd(seed);
    ctx.lineWidth = 1.6;
    for (let i = 0; i < Math.max(1, w / 90); i++) {
        ctx.strokeStyle = `rgba(255,${120 + r() * 60},40,${0.45 + r() * 0.3})`;
        let x = r() * w, y = 6 + r() * 6;
        ctx.beginPath(); ctx.moveTo(x, y);
        while (y < h - 4) { x += (r() - 0.5) * 18; y += 6 + r() * 10; ctx.lineTo(x, Math.min(y, h - 4)); }
        ctx.stroke();
    }
};

const slab = (p: Platform, seed: number, res: number): PlatformPiece => {
    const { canvas, ctx } = makeCanvas(p.w + 20, p.h + SHADOW, res);
    const r = rnd(seed);
    const sg = ctx.createLinearGradient(0, p.h, 0, p.h + SHADOW);
    sg.addColorStop(0, 'rgba(0,0,0,0.5)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg; ctx.fillRect(6, p.h, p.w + 8, SHADOW);
    // Rock body with a ragged underside hanging below the walkable top
    rock(ctx, p.w, p.h + 12, '#5a4a40', '#2a201b');
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(p.w, 0); ctx.lineTo(p.w, p.h - 4);
    for (let x = p.w; x >= 0; x -= 14) ctx.lineTo(x, p.h + r() * 12);
    ctx.closePath(); ctx.fill();
    oreVeins(ctx, p.w, p.h + 6, seed);
    // Steel lip bolted along the top: the edge players stand on reads clearly
    ctx.fillStyle = '#7d838c'; ctx.fillRect(0, 0, p.w, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, 0, p.w, 1.2);
    bolts(ctx, 10, p.w - 4, 2, 48);
    overlayNoise(ctx, 18, 70 + seed, 0.45);
    return { canvas, x: p.x, y: p.y };
};

const floorChunk = (x0: number, p: Platform, w: number, seed: number, res: number): PlatformPiece => {
    const { canvas, ctx } = makeCanvas(w, p.h, res);
    rock(ctx, w, p.h, '#3e3029', '#120d0a');
    ctx.fillRect(0, 0, w, p.h);
    // Strata lines across the bedrock
    for (let y = 30; y < p.h; y += 26) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, y, w, 2); }
    oreVeins(ctx, w, p.h, seed);
    // Rail track on top: sleepers and a steel rail
    for (let sx = 12 - (x0 % 24); sx < w; sx += 24) { ctx.fillStyle = '#3a2716'; ctx.fillRect(sx, 2, 16, 7); }
    ctx.fillStyle = '#8a9099'; ctx.fillRect(0, 0, w, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(0, 0, w, 1);
    const ao = ctx.createLinearGradient(0, 9, 0, 50);
    ao.addColorStop(0, 'rgba(0,0,0,0.5)'); ao.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ao; ctx.fillRect(0, 9, w, 41);
    overlayNoise(ctx, 40, 80 + seed, 0.55);
    return { canvas, x: p.x + x0, y: p.y };
};

const pillarChunk = (y0: number, p: Platform, h: number, seed: number, res: number): PlatformPiece => {
    const { canvas, ctx } = makeCanvas(p.w, h, res);
    const g = ctx.createLinearGradient(0, 0, p.w, 0);
    g.addColorStop(0, '#4a3b32'); g.addColorStop(0.5, '#2c221c'); g.addColorStop(1, '#1a1410');
    ctx.fillStyle = g; ctx.fillRect(0, 0, p.w, h);
    oreVeins(ctx, p.w, h, seed);
    if (p.w >= 30) { // timber props bolted with steel bands
        [0, p.w - 7].forEach(x => { ctx.fillStyle = '#5a3d24'; ctx.fillRect(x, 0, 7, h); });
        for (let y = 120 - (y0 % 120); y < h; y += 120) { ctx.fillStyle = '#5b5f66'; ctx.fillRect(0, y, p.w, 5); }
    }
    overlayNoise(ctx, 40, 90 + seed, 0.5);
    return { canvas, x: p.x, y: p.y + y0 };
};

export const bakeMinePlatform = (p: Platform, seed: number, res = 1): PlatformPiece[] => {
    const kind = kindOf(p);
    if (kind === 'slab') return [slab(p, seed, res)];
    const pieces: PlatformPiece[] = [];
    if (kind === 'floor') for (let x = 0; x < p.w; x += MAX_CHUNK) pieces.push(floorChunk(x, p, Math.min(MAX_CHUNK, p.w - x), seed + x, res));
    else for (let y = 0; y < p.h; y += MAX_CHUNK) pieces.push(pillarChunk(y, p, Math.min(MAX_CHUNK, p.h - y), seed + y, res));
    return pieces;
};
