// Asteroid mine backdrop (Tunnels): deep cave with ore glints, a rock face with strata, timber
// supports and a string of bulbs, ventilation ducts and scaffolding, mine carts and crates.

import { glow, grimeStreaks, makeCanvas, overlayNoise, rnd, stencil } from '../canvasKit';
import { haze } from '../stationBackdrop';

const W = 1120, H = 960;
const TIMBER = '#5a3d24', TIMBER_DARK = '#3a2716';

export const bakeCaveTile = (size = 1024) => {
    const { canvas, ctx } = makeCanvas(size, size);
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, '#0b0807'); g.addColorStop(1, '#160f0b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    const r = rnd(71);
    ['#120c09', '#17100c', '#1c140f'].forEach((col, i) => {
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(0, size);
        for (let x = 0; x <= size; x += 32) ctx.lineTo(x, size * (0.35 + i * 0.2) + Math.sin((x / size) * Math.PI * 4 + i) * 40 + r() * 30);
        ctx.lineTo(size, size); ctx.fill();
    });
    for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(255,${130 + r() * 60},60,${0.2 + r() * 0.6})`; ctx.fillRect(r() * size, r() * size, 1.5, 1.5); }
    glow(ctx, size * 0.3, size * 0.55, 160, '#ff9a40', 0.1);
    glow(ctx, size * 0.75, size * 0.3, 120, '#ff9a40', 0.08);
    return canvas;
};

const timberPost = (ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number, w: number) => {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#6e4c2e'); g.addColorStop(1, TIMBER_DARK);
    ctx.fillStyle = g; ctx.fillRect(x, y0, w, y1 - y0);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let gy = y0 + 6; gy < y1; gy += 17) ctx.fillRect(x + 3, gy, w - 6, 1); // wood grain
};

export const bakeRockWallTile = () => {
    const { canvas, ctx } = makeCanvas(W, H);
    ctx.fillStyle = '#241a15'; ctx.fillRect(0, 0, W, H);
    // Strata: wavy bands whose waves repeat exactly across the tile width
    const bands = ['#2e221b', '#271d17', '#33261e', '#2a1f19', '#30241c', '#261c16'];
    bands.forEach((col, i) => {
        const base = i * (H / bands.length);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(0, base + H / bands.length + 20);
        for (let x = 0; x <= W; x += 20) ctx.lineTo(x, base + Math.sin((x / W) * Math.PI * 4 + i) * 18);
        ctx.lineTo(W, base + H / bands.length + 20); ctx.fill();
    });
    overlayNoise(ctx, 120, 61, 0.7);
    overlayNoise(ctx, 10, 62, 0.4, 'soft-light');
    const r = rnd(63);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 26; i++) { // cracks
        let x = r() * W, y = r() * H;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 50; y += r() * 40; ctx.lineTo(x, y); }
        ctx.stroke();
    }
    grimeStreaks(ctx, W, H, 50, 64);
    // Timber supports and the cap beam
    [0, 560].forEach(x => timberPost(ctx, x, 0, H, 22));
    ctx.fillStyle = TIMBER; ctx.fillRect(0, 70, W, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0, 70, W, 2);
    // String of bulbs sagging between the posts
    ctx.strokeStyle = '#0d0907'; ctx.lineWidth = 2;
    [0, 560].forEach(x0 => {
        ctx.beginPath(); ctx.moveTo(x0 + 22, 92); ctx.quadraticCurveTo(x0 + 290, 150, x0 + 560, 92); ctx.stroke();
        for (let k = 1; k < 8; k++) {
            const t = k / 8, bx = x0 + 22 + t * 538, by = 92 + 2 * t * (1 - t) * 58 + 4;
            glow(ctx, bx, by, 26, '#ffb060', 0.35);
            ctx.fillStyle = '#ffd9a0'; ctx.beginPath(); ctx.arc(bx, by, 2.5, 0, Math.PI * 2); ctx.fill();
        }
    });
    stencil(ctx, 'SHAFT 7', 120, 420, 58, '#e8c59a', 0.1);
    stencil(ctx, 'ГОРИЗОНТ −340', 640, 560, 26, '#e8c59a', 0.14);
    stencil(ctx, '⚠ ВЗРЫВНЫЕ РАБОТЫ', 640, 760, 16, '#d9a514', 0.3);
    return canvas;
};

export const bakeScaffoldTile = () => {
    const { canvas, ctx } = makeCanvas(W, H);
    [280, 840].forEach(x => timberPost(ctx, x, 0, H, 16));
    ctx.strokeStyle = TIMBER_DARK; ctx.lineWidth = 6;
    for (let y = 0; y < H; y += 240) [280, 840].forEach(x => {
        ctx.beginPath(); ctx.moveTo(x + 16, y); ctx.lineTo(x + 120, y + 240); ctx.stroke();
    });
    // Ventilation duct with ribs
    const d = ctx.createLinearGradient(0, 150, 0, 196);
    d.addColorStop(0, '#5b5f66'); d.addColorStop(0.4, '#363a40'); d.addColorStop(1, '#141619');
    ctx.fillStyle = d; ctx.fillRect(0, 150, W, 46);
    for (let x = 0; x < W; x += 40) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x, 150, 3, 46); }
    for (let x = 100; x < W; x += 560) { ctx.fillStyle = '#1a1c20'; ctx.fillRect(x, 144, 10, 58); }
    ctx.strokeStyle = '#0b0807'; ctx.lineWidth = 2;
    [[120, 200], [700, 205]].forEach(([x, y]) => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4, y + 120); ctx.stroke(); });
    overlayNoise(ctx, 120, 66, 0.5);
    haze(ctx, 0.22);
    return canvas;
};

export const bakeMineCart = (w = 150, h = 74) => {
    const { canvas, ctx } = makeCanvas(w, h);
    glow(ctx, w / 2, 14, w * 0.5, '#ff8a30', 0.25);
    ctx.fillStyle = '#c86a2a';
    ctx.beginPath(); ctx.moveTo(12, 20); ctx.quadraticCurveTo(w / 2, -2, w - 12, 20); ctx.fill();          // glowing ore pile
    ctx.fillStyle = '#3a3f46';
    ctx.beginPath(); ctx.moveTo(6, 18); ctx.lineTo(w - 6, 18); ctx.lineTo(w - 18, h - 16); ctx.lineTo(18, h - 16); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(6, 18, w - 12, 2);
    ctx.fillStyle = '#141619';
    [32, w - 32].forEach(x => { ctx.beginPath(); ctx.arc(x, h - 10, 9, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = '#5b5f66'; ctx.fillRect(0, h - 3, w, 3);                                              // rail
    overlayNoise(ctx, 30, 67, 0.4);
    return canvas;
};
