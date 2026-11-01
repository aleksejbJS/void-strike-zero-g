// Canvas 2D helpers for baking map art once at load: seeded randomness, fractal noise,
// texture overlays, stencilled lettering, bolts and worn hazard paint.

export const rnd = (seed: number) => {
    let s = seed >>> 0 || 1;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

export const makeCanvas = (w: number, h: number, scale = 1) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(w * scale));
    canvas.height = Math.max(1, Math.ceil(h * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    ctx.scale(scale, scale);
    return { canvas, ctx };
};

const noiseCache = new Map<string, HTMLCanvasElement>();

/** Fractal value noise (grey around 50%), cached by size and grain. */
export const noise = (w: number, h: number, cell: number, seed: number, octaves = 4) => {
    const key = `${w}x${h}:${cell}:${seed}:${octaves}`;
    const cached = noiseCache.get(key);
    if (cached) return cached;
    const { canvas, ctx } = makeCanvas(w, h);
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    const r = rnd(seed);
    for (let i = 0; i < octaves; i++) {
        const gw = Math.max(2, Math.ceil(w / (cell / 2 ** i)));
        const gh = Math.max(2, Math.ceil(h / (cell / 2 ** i)));
        const grid = makeCanvas(gw, gh);
        const img = grid.ctx.createImageData(gw, gh);
        for (let p = 0; p < img.data.length; p += 4) {
            const v = r() * 255;
            img.data[p] = img.data[p + 1] = img.data[p + 2] = v;
            img.data[p + 3] = 255;
        }
        grid.ctx.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.globalAlpha = 0.5 / 2 ** i;
        ctx.drawImage(grid.canvas, 0, 0, w, h);
    }
    ctx.globalAlpha = 1;
    noiseCache.set(key, canvas);
    return canvas;
};

/** Noise blended over what is already drawn (transparent areas stay transparent). */
export const overlayNoise = (ctx: CanvasRenderingContext2D, cell: number, seed: number, alpha: number, mode: GlobalCompositeOperation = 'overlay') => {
    const { width, height } = ctx.canvas;
    const src = noise(width, height, cell, seed, cell < 30 ? 3 : 4);
    const tmp = makeCanvas(width, height);
    tmp.ctx.drawImage(src, 0, 0);
    tmp.ctx.globalCompositeOperation = 'destination-in';
    tmp.ctx.drawImage(ctx.canvas, 0, 0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = mode;
    ctx.globalAlpha = alpha;
    ctx.drawImage(tmp.canvas, 0, 0);
    ctx.restore();
};

export const rgba = (hex: string, a: number) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

export const glow = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, hex: string, a: number) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(hex, a));
    g.addColorStop(1, rgba(hex, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
};

const DISPLAY_FONT = '"Big Shoulders Display", "Fira Sans Extra Condensed", "Arial Narrow", sans-serif';

/** Stencilled lettering: thin bridges cut through the letters, like spray-painted signage. */
export const stencil = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, alpha: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha;
    ctx.font = `900 ${size}px ${DISPLAY_FONT}`;
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    for (let i = 0; i < text.length * 2; i++) ctx.fillRect(i * size * 0.32 + size * 0.12, -size * 0.85, size * 0.05, size);
    ctx.restore();
};

export const bolts = (ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, step: number) => {
    for (let x = x0; x < x1; x += step) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath(); ctx.arc(x + 0.6, y + 0.6, 1.7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(190,205,220,0.55)';
        ctx.beginPath(); ctx.arc(x, y, 1.3, 0, Math.PI * 2); ctx.fill();
    }
};

/** Hazard chevrons with chipped paint. */
export const wornHazard = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number) => {
    const r = rnd(seed);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = '#16181b';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#d9a514';
    for (let i = x - 30; i < x + w + 30; i += 16) {
        ctx.beginPath(); ctx.moveTo(i, y + h); ctx.lineTo(i + h, y); ctx.lineTo(i + h + 7, y); ctx.lineTo(i + 7, y + h); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < w / 6; i++) {
        ctx.fillStyle = `rgba(40,42,46,${0.5 + r() * 0.5})`;
        ctx.fillRect(x + r() * w, y + r() * h, 1 + r() * 4, 1 + r() * 2);
    }
    ctx.restore();
};

/** Dark streaks running down from seams and vents. */
export const grimeStreaks = (ctx: CanvasRenderingContext2D, w: number, h: number, count: number, seed: number) => {
    const r = rnd(seed);
    for (let i = 0; i < count; i++) {
        const sx = r() * w, sy = r() * h, len = 20 + r() * 90;
        const g = ctx.createLinearGradient(0, sy, 0, sy + len);
        g.addColorStop(0, 'rgba(5,7,9,0.35)');
        g.addColorStop(1, 'rgba(5,7,9,0)');
        ctx.fillStyle = g;
        ctx.fillRect(sx, sy, 1 + r() * 2.5, len);
    }
};
