// Station platform art, baked once per platform: thin decks (metal plate with bolts, worn
// hazard edge, gussets and a soft cast shadow), heavy floors (grating lit from below) and
// tall hull columns. Long pieces are cut into chunks small enough for phone GPUs.

import { Platform } from '../../../types';
import { bolts, makeCanvas, overlayNoise, stencil, wornHazard } from './canvasKit';

export interface PlatformPiece {
    canvas: HTMLCanvasElement;
    x: number; // world position of the canvas' top-left corner
    y: number;
}

const MAX_CHUNK = 2048;
const SHADOW = 40;   // cast shadow below decks
const SHADOW_X = 24; // shadow leans right, away from the window light

const TEAM_FACE: Record<string, [string, string]> = {
    '#3b82f6': ['#2b4a8a', '#16264a'],
    '#ef4444': ['#8a2b2b', '#4a1616'],
};

const kindOf = (p: Platform) => {
    if (p.h > p.w) return 'column';
    if (p.h >= 100 || p.w > 1200) return 'floor';
    return 'deck';
};

const deck = (p: Platform, seed: number, res: number): PlatformPiece => {
    const { canvas, ctx } = makeCanvas(p.w + SHADOW_X + 4, p.h + SHADOW, res);
    // Cast shadow on the wall behind
    const sg = ctx.createLinearGradient(0, p.h, 0, p.h + SHADOW);
    sg.addColorStop(0, 'rgba(0,0,0,0.5)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.moveTo(4, p.h); ctx.lineTo(p.w, p.h); ctx.lineTo(p.w + SHADOW_X, p.h + SHADOW); ctx.lineTo(28, p.h + SHADOW); ctx.fill();
    // Gussets underneath
    ctx.fillStyle = '#151b22';
    for (let gx = 30; gx < p.w - 20; gx += 110) { ctx.beginPath(); ctx.moveTo(gx, p.h); ctx.lineTo(gx + 18, p.h); ctx.lineTo(gx + 4, p.h + 14); ctx.fill(); }
    // Face
    const [top, bottom] = TEAM_FACE[p.color] ?? ['#3b4554', '#232a33'];
    const fg = ctx.createLinearGradient(0, 0, 0, p.h);
    fg.addColorStop(0, top); fg.addColorStop(1, bottom);
    ctx.fillStyle = fg; ctx.fillRect(0, 0, p.w, p.h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, p.h * 0.45, p.w, 1.2);
    for (let sx = 64; sx < p.w - 10; sx += 64) { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(sx, 4, 1.2, Math.max(2, p.h - 11)); }
    if (p.h >= 18) bolts(ctx, 8, p.w - 4, 7, 32);
    wornHazard(ctx, 0, p.h - Math.min(7, p.h * 0.3), p.w, Math.min(7, p.h * 0.3), seed);
    const lip = ctx.createLinearGradient(0, 0, p.w, 0);
    lip.addColorStop(0, '#a9b8c9'); lip.addColorStop(0.35, '#7d8a9a'); lip.addColorStop(1, '#556170');
    ctx.fillStyle = lip; ctx.fillRect(0, 0, p.w, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(p.w - 2, 0, 2, p.h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(0, 0, 1.5, p.h);
    overlayNoise(ctx, 14, 23 + seed, 0.35);
    return { canvas, x: p.x, y: p.y };
};

const floorChunk = (x0: number, p: Platform, w: number, seed: number, res: number): PlatformPiece => {
    const { canvas, ctx } = makeCanvas(w, p.h, res);
    ctx.fillStyle = '#0c1014'; ctx.fillRect(0, 0, w, p.h);
    // Grating with warm light coming up through it
    const glowG = ctx.createLinearGradient(0, 6, 0, 28);
    glowG.addColorStop(0, 'rgba(255,170,70,0)'); glowG.addColorStop(1, 'rgba(255,170,70,0.35)');
    ctx.fillStyle = glowG; ctx.fillRect(0, 6, w, 22);
    ctx.fillStyle = '#1e252e';
    for (let gx = 0; gx < w; gx += 9) ctx.fillRect(gx, 6, 3, 22);
    ctx.fillRect(0, 16, w, 2);
    const face = ctx.createLinearGradient(0, 28, 0, p.h);
    face.addColorStop(0, '#262e38'); face.addColorStop(0.3, '#151a21'); face.addColorStop(1, '#07090c');
    ctx.fillStyle = face; ctx.fillRect(0, 28, w, p.h - 28);
    // Panel seams and bolts down the thick face
    for (let sx = 160 - (x0 % 160); sx < w; sx += 160) { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(sx, 34, 1.5, p.h - 40); }
    bolts(ctx, 12, w, 40, 40);
    if (seed % 3 === 0) stencil(ctx, `C-0${(seed % 7) + 1}`, w * 0.7, 80, 22, '#c9d3dd', 0.2);
    wornHazard(ctx, 0, 28, w, 5, seed);
    // Shadow cast by the deck edge onto the thick floor face
    const ao = ctx.createLinearGradient(0, 33, 0, 70);
    ao.addColorStop(0, 'rgba(0,0,0,0.55)'); ao.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ao; ctx.fillRect(0, 33, w, 37);
    const lip = ctx.createLinearGradient(0, 0, w, 0);
    lip.addColorStop(0, '#9fb0c2'); lip.addColorStop(1, '#5b6776');
    ctx.fillStyle = lip; ctx.fillRect(0, 0, w, 3);
    overlayNoise(ctx, 40, 31 + seed, 0.4);
    return { canvas, x: p.x + x0, y: p.y };
};

const columnChunk = (y0: number, p: Platform, h: number, seed: number, res: number): PlatformPiece => {
    const { canvas, ctx } = makeCanvas(p.w, h, res);
    const g = ctx.createLinearGradient(0, 0, p.w, 0);
    g.addColorStop(0, '#2c3540'); g.addColorStop(0.5, '#1a2129'); g.addColorStop(1, '#0f1419');
    ctx.fillStyle = g; ctx.fillRect(0, 0, p.w, h);
    for (let y = 96 - (y0 % 96); y < h; y += 96) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, y, p.w, 2); ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, y + 2, p.w, 1); }
    for (let x = 14; x < p.w - 6; x += Math.max(24, p.w / 4)) for (let y = 10; y < h; y += 48) bolts(ctx, x, x + 1, y, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, 0, 2, h);
    if (p.w >= 60) wornHazard(ctx, p.w - 10, 0, 10, h, seed);
    overlayNoise(ctx, 60, 41 + seed, 0.45);
    return { canvas, x: p.x, y: p.y + y0 };
};

export const bakePlatform = (p: Platform, seed: number, res = 1): PlatformPiece[] => {
    const kind = kindOf(p);
    if (kind === 'deck') return [deck(p, seed, res)];
    const pieces: PlatformPiece[] = [];
    if (kind === 'floor') for (let x = 0; x < p.w; x += MAX_CHUNK) pieces.push(floorChunk(x, p, Math.min(MAX_CHUNK, p.w - x), seed + x, res));
    else for (let y = 0; y < p.h; y += MAX_CHUNK) pieces.push(columnChunk(y, p, Math.min(MAX_CHUNK, p.h - y), seed + y, res));
    return pieces;
};
