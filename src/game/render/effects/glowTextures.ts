// Two white baked textures the particle view tints and scales: a soft round glow and a
// streak that fades toward its tail. Kept for the whole session (not in bakedTextures,
// which the scene destroys on every map change).

import { Texture } from 'pixi.js';
import { makeCanvas } from '../scene/canvasKit';

const GLOW_SIZE = 64;
const STRIP_W = 64;
const STRIP_H = 8;

let glow: Texture | null = null;
let strip: Texture | null = null;

/** 64 x 64 radial glow: opaque white at the centre, fully transparent at the edge. */
export const glowTexture = (): Texture => {
    if (glow) return glow;
    const { canvas, ctx } = makeCanvas(GLOW_SIZE, GLOW_SIZE);
    const c = GLOW_SIZE / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.45)'); // softer falloff than a straight line
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE);
    glow = Texture.from(canvas, true);
    return glow;
};

/** 64 x 8 streak: transparent at the tail (x = 0), white at the head (x = 64). */
export const stripTexture = (): Texture => {
    if (strip) return strip;
    const { canvas, ctx } = makeCanvas(STRIP_W, STRIP_H);
    const g = ctx.createLinearGradient(0, 0, STRIP_W, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, STRIP_W, STRIP_H);
    strip = Texture.from(canvas, true);
    return strip;
};
