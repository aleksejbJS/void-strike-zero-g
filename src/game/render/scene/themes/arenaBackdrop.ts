// Arena backdrop (Hunger Games): a dark dome with a lit lattice and camera flashes, tiers of
// stands packed with a crowd behind lime-lit railings, and truss towers carrying the rigging.

import { glow, makeCanvas, overlayNoise, rnd, stencil } from '../canvasKit';
import { haze } from '../stationBackdrop';

const W = 1120, H = 960;
const LIME = '#a3e635';
const TIER = 120;

export const bakeDomeTile = (size = 1024) => {
    const { canvas, ctx } = makeCanvas(size, size);
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, '#04060c'); g.addColorStop(1, '#0a0f1c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(90,110,150,0.16)'; ctx.lineWidth = 2;
    for (let x = 0; x <= size; x += 128) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke(); }
    for (let y = 0; y <= size; y += 128) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke(); }
    for (let x = 0; x <= size; x += 128) for (let y = 0; y <= size; y += 128) glow(ctx, x, y, 10, '#9fb4ff', 0.18);
    const r = rnd(81);
    for (let i = 0; i < 90; i++) { ctx.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`; ctx.fillRect(r() * size, r() * size, 1.5, 1.5); } // camera flashes
    return canvas;
};

export const bakeStandsTile = () => {
    const { canvas, ctx } = makeCanvas(W, H);
    const r = rnd(83);
    for (let y = 0; y < H; y += TIER) {
        const g = ctx.createLinearGradient(0, y, 0, y + TIER);
        g.addColorStop(0, '#0d111a'); g.addColorStop(1, '#161c28');
        ctx.fillStyle = g; ctx.fillRect(0, y, W, TIER);
        // Crowd: heads and shoulders in the seat rows
        for (let row = 0; row < 3; row++) for (let x = 6 + row * 7; x < W; x += 14) {
            // Dim silhouettes with the odd team scarf: a crowd, not wallpaper competing with the fight
            const shade = 20 + Math.floor(r() * 22);
            const tint = r();
            ctx.fillStyle = tint < 0.05 ? '#5a2410' : tint < 0.1 ? '#1a2d66' : `rgb(${shade},${shade + 4},${shade + 10})`;
            const cy = y + 26 + row * 26;
            ctx.beginPath(); ctx.arc(x, cy, 4, 0, Math.PI * 2); ctx.fill();
            ctx.fillRect(x - 5, cy + 4, 10, 9);
        }
        // Railing with a lime light strip at the front of each tier
        ctx.fillStyle = '#2b3240'; ctx.fillRect(0, y + TIER - 18, W, 6);
        ctx.fillStyle = LIME; ctx.globalAlpha = 0.35; ctx.fillRect(0, y + TIER - 12, W, 2); ctx.globalAlpha = 1;
        for (let x = 0; x < W; x += 70) { ctx.fillStyle = '#2b3240'; ctx.fillRect(x, y + TIER - 34, 3, 22); }
    }
    overlayNoise(ctx, 80, 84, 0.45);
    stencil(ctx, 'SECTOR B', 60, 230, 40, '#c9d3dd', 0.12);
    stencil(ctx, 'VOID GAMES', 620, 470, 48, '#a3e635', 0.12);
    haze(ctx, 0.35);
    return canvas;
};

export const bakeTrussTile = () => {
    const { canvas, ctx } = makeCanvas(W, H);
    [200, 760].forEach(x => {
        ctx.fillStyle = '#1f2633'; ctx.fillRect(x, 0, 6, H); ctx.fillRect(x + 40, 0, 6, H);
        ctx.strokeStyle = '#1f2633'; ctx.lineWidth = 3; ctx.beginPath();
        for (let y = 0; y < H; y += 40) { ctx.moveTo(x + 3, y); ctx.lineTo(x + 43, y + 20); ctx.lineTo(x + 3, y + 40); }
        ctx.stroke();
        // Speaker cluster and a small rig light
        ctx.fillStyle = '#0e1219'; ctx.fillRect(x - 14, 300, 74, 60);
        ctx.fillStyle = '#222b39'; for (let k = 0; k < 3; k++) ctx.fillRect(x - 8 + k * 22, 310, 18, 40);
        glow(ctx, x + 23, 296, 18, '#e6f0ff', 0.4);
    });
    ctx.strokeStyle = '#0a0d13'; ctx.lineWidth = 2;
    [[0, 240, 200], [246, 236, 760], [806, 244, 1120]].forEach(([a, y, b]) => { ctx.beginPath(); ctx.moveTo(a, y); ctx.quadraticCurveTo((a + b) / 2, y + 50, b, y); ctx.stroke(); });
    haze(ctx, 0.2);
    return canvas;
};
