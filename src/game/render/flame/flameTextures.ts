// The flame's white textures, drawn once on canvases (after the owner's demo) and tinted per sprite: soft flame
// and smoke puffs, a hard spark core, a nozzle core, a light glow, a flat fire bed and a tongue of flame.
// Kept for the whole session and shared by every view: never destroyed.

import { Texture } from 'pixi.js';
import { makeCanvas } from '../scene/canvasKit';

export interface FlameTextures {
    flame: Texture; smoke: Texture; core: Texture; ember: Texture; glow: Texture; pool: Texture; tongue: Texture;
}

type Ctx = CanvasRenderingContext2D;

/** A soft round puff of white whose alpha falls off smoothly from `peak` at the centre to 0 at `rad`. */
const soft = (g: Ctx, cx: number, cy: number, rad: number, peak: number) => {
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
    const stops: [number, number][] = [[0, 1], [0.15, 0.674], [0.3, 0.391], [0.45, 0.196], [0.62, 0.076], [0.8, 0.02], [1, 0]];
    for (const [at, k] of stops) gr.addColorStop(at, `rgba(255,255,255,${peak * k})`);
    g.fillStyle = gr;
    g.beginPath();
    g.arc(cx, cy, rad, 0, Math.PI * 2);
    g.fill();
};

/** A big soft puff with a few faint lumps around its centre, so overlapping puffs do not look like discs. */
const lumpy = (size: number, peak: number, lumps: number, offset: number, lumpRad: number, lumpPeak: number) =>
    paint(size, size, (g, s) => {
        g.globalCompositeOperation = 'lighter';
        soft(g, s / 2, s / 2, s / 2, peak);
        for (let i = 0; i < lumps; i++) {
            const a = Math.random() * Math.PI * 2, d = Math.random() * offset * s;
            soft(g, s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d, s * lumpRad, lumpPeak);
        }
    });

const radial = (size: number, stops: [number, number][]) => paint(size, size, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    for (const [at, a] of stops) gr.addColorStop(at, `rgba(255,255,255,${a})`);
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
});

const paint = (w: number, h: number, draw: (g: Ctx, w: number, h: number) => void): Texture => {
    const { canvas, ctx } = makeCanvas(w, h);
    draw(ctx, w, h);
    return Texture.from(canvas, true);
};

/** A tongue of flame standing on its base: a column of puffs narrowing and swaying upward, fading at the tip. */
const tongue = () => paint(96, 160, (g, w, h) => {
    const seed = Math.random() * 10;
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
        const t = i / 25;
        soft(g, w / 2 + Math.sin(t * 3.6 + seed) * w * 0.1 * t, h * (0.96 - t * 0.92), w * (0.44 * (1 - t) ** 0.55 + 0.06), 0.115 * (1 - t * 0.3));
    }
    soft(g, w / 2, h * 0.94, w * 0.42, 0.34);
    g.globalCompositeOperation = 'destination-in';
    const m = g.createLinearGradient(0, h, 0, 0);
    m.addColorStop(0, 'rgba(0,0,0,0.9)'); m.addColorStop(0.14, 'rgba(0,0,0,1)');
    m.addColorStop(0.8, 'rgba(0,0,0,0.62)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = m;
    g.fillRect(0, 0, w, h);
});

let cached: FlameTextures | null = null;

export const flameTextures = (): FlameTextures => {
    cached ??= {
        flame: lumpy(128, 0.85, 5, 0.17, 0.3, 0.05),
        smoke: lumpy(160, 0.42, 7, 0.22, 0.28, 0.05),
        core: paint(64, 64, (g, s) => soft(g, s / 2, s / 2, s / 2, 1)),
        // A spark keeps a hard hot core, or at 2–3 px it would vanish
        ember: radial(32, [[0, 1], [0.16, 1], [0.34, 0.62], [0.55, 0.24], [0.78, 0.06], [1, 0]]),
        glow: radial(256, [[0, 0.8], [0.3, 0.3], [0.6, 0.08], [1, 0]]),
        pool: lumpy(128, 0.7, 4, 0.2, 0.26, 0.06),
        tongue: tongue(),
    };
    return cached;
};
