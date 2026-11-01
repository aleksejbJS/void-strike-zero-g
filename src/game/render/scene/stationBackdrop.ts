// Station backdrop art, baked once: repeating tiles (space, hull wall with windows, girders
// and pipes) plus one-off pieces (planet, cargo containers). Tile edges sit on panel seams
// so the repetition does not show.

import { bolts, glow, grimeStreaks, makeCanvas, overlayNoise, rnd, stencil } from './canvasKit';

// Heights are tuned for the usual camera: the window band shows above the fighters' heads,
// the ad posters between the windows and the floor.
export const WALL_TILE = { w: 1120, h: 960, windowY: 12, windowH: 118 };
export const MID_TILE = { w: 1120, h: 960 };
const PANEL_W = 140, PANEL_H = 96;

export const bakeStarTile = (size = 1024) => {
    const { canvas, ctx } = makeCanvas(size, size);
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, '#03050a'); g.addColorStop(1, '#0a1220');
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    const r = rnd(5);
    for (let i = 0; i < 520; i++) {
        const s = r() < 0.92 ? 1 : 2;
        ctx.fillStyle = `rgba(${200 + r() * 55},${210 + r() * 45},255,${0.25 + r() * 0.75})`;
        ctx.fillRect(r() * size, r() * size, s, s);
    }
    glow(ctx, size * 0.3, size * 0.25, 300, '#5b3a8c', 0.16);
    glow(ctx, size * 0.7, size * 0.6, 260, '#1f6c86', 0.12);
    return canvas;
};

export const bakePlanet = (radius = 420) => {
    const size = radius * 2 + 40;
    const { canvas, ctx } = makeCanvas(size, size);
    const c = size / 2;
    const pg = ctx.createRadialGradient(c - radius * 0.45, c - radius * 0.6, 20, c, c, radius);
    pg.addColorStop(0, '#6fb7c9'); pg.addColorStop(0.35, '#2b6577'); pg.addColorStop(0.75, '#0d2530'); pg.addColorStop(1, '#050b10');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(c, c, radius, 0, Math.PI * 2); ctx.fill();
    overlayNoise(ctx, 160, 11, 0.5);
    ctx.strokeStyle = 'rgba(150,225,255,0.55)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(c, c, radius + 1, Math.PI * 1.08, Math.PI * 1.62); ctx.stroke();
    glow(ctx, c - radius * 0.5, c - radius * 0.7, radius * 0.8, '#7fd3ff', 0.12);
    return canvas;
};

export const bakeWallTile = () => {
    const { w, h, windowY, windowH } = WALL_TILE;
    const { canvas, ctx } = makeCanvas(w, h);
    const r = rnd(9);
    ctx.fillStyle = '#121820'; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += PANEL_H) for (let x = 0; x < w; x += PANEL_W) {
        const shade = 18 + Math.floor(r() * 6);
        ctx.fillStyle = `rgb(${shade},${shade + 6},${shade + 12})`; ctx.fillRect(x + 2, y + 2, PANEL_W - 4, PANEL_H - 4);
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x + 2, y + 2, PANEL_W - 4, 1.5); ctx.fillRect(x + 2, y + 2, 1.5, PANEL_H - 4);
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x + 2, y + PANEL_H - 3.5, PANEL_W - 4, 1.5); ctx.fillRect(x + PANEL_W - 3.5, y + 2, 1.5, PANEL_H - 4);
        if (r() < 0.2) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (let v = 0; v < 6; v++) ctx.fillRect(x + 18 + v * 8, y + 60, 5, 22); }
    }
    overlayNoise(ctx, 160, 11, 0.55);
    overlayNoise(ctx, 14, 23, 0.35, 'soft-light');
    grimeStreaks(ctx, w, h, 80, 3);
    stencil(ctx, 'BAY 03', 380, 420, 64, '#c9d3dd', 0.09);
    stencil(ctx, 'DECK C', 700, 560, 30, '#c9d3dd', 0.12);
    stencil(ctx, '⚠ НЕ СТОЯТЬ ПОД ГРУЗОМ', 380, 720, 15, '#d9a514', 0.3);

    // Window band: cut through to the stars, then a heavy frame and mullions
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, windowY, w, windowH);
    ctx.restore();
    ctx.fillStyle = '#1b222b';
    ctx.fillRect(0, windowY - 10, w, 10); ctx.fillRect(0, windowY + windowH, w, 12);
    for (let mx = 0; mx < w; mx += PANEL_W * 2) {
        ctx.fillStyle = '#1b222b'; ctx.fillRect(mx, windowY, 14, windowH);
        ctx.fillStyle = 'rgba(255,255,255,0.09)'; ctx.fillRect(mx, windowY, 2, windowH);
    }
    ctx.fillStyle = 'rgba(160,220,255,0.12)'; ctx.fillRect(0, windowY - 10, w, 1.5);
    bolts(ctx, 10, w, windowY - 5, 35); bolts(ctx, 10, w, windowY + windowH + 6, 35);
    // Faint reflections on the glass
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
        const sx = 60 + i * 190;
        ctx.fillStyle = 'rgba(180,220,255,0.035)';
        ctx.beginPath(); ctx.moveTo(sx, windowY); ctx.lineTo(sx + 40, windowY); ctx.lineTo(sx - 30, windowY + windowH); ctx.lineTo(sx - 70, windowY + windowH); ctx.fill();
    }
    ctx.restore();
    return canvas;
};

export const bakeMidTile = () => {
    const { w, h } = MID_TILE;
    const { canvas, ctx } = makeCanvas(w, h);
    const steel = '#1d2631', steelLit = '#2a3644';
    [[140, 34], [700, 34]].forEach(([gx, gw]) => {
        ctx.fillStyle = steel; ctx.fillRect(gx, 0, 6, h); ctx.fillRect(gx + gw, 0, 6, h);
        ctx.fillStyle = steelLit; ctx.fillRect(gx, 0, 1.5, h);
        ctx.strokeStyle = steel; ctx.lineWidth = 3.5; ctx.beginPath();
        for (let y = 0; y < h; y += 40) { ctx.moveTo(gx + 3, y); ctx.lineTo(gx + gw + 3, y + 20); ctx.lineTo(gx + 3, y + 40); }
        ctx.stroke();
    });
    ([[176, 9, '#232e3a'], [190, 6, '#2a3540'], [200, 4, '#1c252f']] as const).forEach(([y, r, col]) => {
        const g = ctx.createLinearGradient(0, y - r, 0, y + r);
        g.addColorStop(0, '#3a4756'); g.addColorStop(0.35, col); g.addColorStop(1, '#0d1117');
        ctx.fillStyle = g; ctx.fillRect(0, y - r, w, r * 2);
        for (let fx = 70; fx < w; fx += 280) { ctx.fillStyle = '#0f141a'; ctx.fillRect(fx, y - r - 2, 6, r * 2 + 4); }
    });
    ctx.strokeStyle = '#3b2a20'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(500, 176, 12, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(488, 176); ctx.lineTo(512, 176); ctx.moveTo(500, 164); ctx.lineTo(500, 188); ctx.stroke();
    ctx.strokeStyle = '#0b0e12'; ctx.lineWidth = 2.5;
    ([[0, 210, 280], [280, 205, 700], [700, 212, 1120]] as const).forEach(([a, y, b]) => {
        ctx.beginPath(); ctx.moveTo(a, y); ctx.quadraticCurveTo((a + b) / 2, y + 60, b, y); ctx.stroke();
    });
    overlayNoise(ctx, 160, 17, 0.5);
    haze(ctx);
    return canvas;
};

/** Thin fog over a far layer: lifts its blacks toward the station air colour. */
export const haze = (ctx: CanvasRenderingContext2D, alpha = 0.28) => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(40,62,78,${alpha})`;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
};

export const bakeContainer = (w: number, h: number, color: string, label: string, labelInCorner = false) => {
    const { canvas, ctx } = makeCanvas(w, h);
    ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
    for (let sx = 4; sx < w - 2; sx += 7) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(sx, 4, 3, h - 8); }
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0, 0, w, 2);
    if (labelInCorner) stencil(ctx, label, w - 34, 14, 11, '#d8d2c4', 0.45);
    else stencil(ctx, label, 12, h * 0.62, h * 0.42, '#d8d2c4', 0.35);
    overlayNoise(ctx, 60, 29, 0.45);
    return canvas;
};
