// Ad places as Pixi objects: the in-world frame (lightbox, container sticker, LED panel),
// the creative on it (a house poster for now) and the wear/glass on top that makes it
// look like part of the station.

import { Container, Sprite } from 'pixi.js';
import { AdPlace, DECAL_CONTAINER } from './adPlaces';
import { houseAds } from './houseAds';
import { bolts, glow, makeCanvas, noise, rnd } from './canvasKit';
import { bakeContainer } from './stationBackdrop';
import { bakedTexture } from './bakedTextures';

const SCREEN_PERIOD_MS = 8000;
const CROSSFADE_MS = 800;
const GLOW_PAD = 30;

export interface AdPlaceView {
    place: AdPlace;
    root: Container;
    creatives: Sprite[];
}

const sprite = (canvas: HTMLCanvasElement, x: number, y: number, w?: number, h?: number) => {
    const s = new Sprite(bakedTexture(canvas));
    s.position.set(x, y);
    if (w !== undefined && h !== undefined) { s.width = w; s.height = h; }
    return s;
};

/** Light grey grime for a multiply blend (white = untouched). */
const grime = (w: number, h: number, seed: number, strength: number) => {
    const { canvas, ctx } = makeCanvas(w, h);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = strength; ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(noise(256, 256, 60, seed), 0, 0, w, h);
    return canvas;
};

const sheen = (w: number, h: number) => {
    const { canvas, ctx } = makeCanvas(w, h);
    ctx.fillStyle = 'rgba(200,230,255,0.09)';
    ctx.beginPath(); ctx.moveTo(w * 0.15, 0); ctx.lineTo(w * 0.45, 0); ctx.lineTo(w * 0.05, h); ctx.lineTo(-w * 0.25, h); ctx.fill();
    return canvas;
};

const lightboxFrame = (p: AdPlace) => {
    const { canvas, ctx } = makeCanvas(p.w + GLOW_PAD * 2, p.h + GLOW_PAD * 2);
    const x = GLOW_PAD, y = GLOW_PAD;
    glow(ctx, x + p.w / 2, y + p.h / 2, p.w * 0.9, '#d6b0ff', 0.08);              // backlight spilling on the wall
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - 3, y - 1, p.w + 10, p.h + 8);
    ctx.fillStyle = '#2a323c'; ctx.fillRect(x - 5, y - 5, p.w + 10, p.h + 10);
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(x - 5, y - 5, p.w + 10, 1.5);
    bolts(ctx, x - 2, x + p.w + 4, y - 2.5, p.w + 4);
    bolts(ctx, x - 2, x + p.w + 4, y + p.h + 2.5, p.w + 4);
    return canvas;
};

const screenBezel = (p: AdPlace) => {
    const { canvas, ctx } = makeCanvas(p.w + 8, p.h + 30);
    ctx.fillStyle = '#1d2631'; ctx.fillRect(p.w * 0.2, 0, 4, 22); ctx.fillRect(p.w * 0.8, 0, 4, 22);   // hangers
    ctx.fillStyle = '#0c1015'; ctx.fillRect(0, 22, p.w + 8, p.h + 8);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0, 22, p.w + 8, 1.5);
    return canvas;
};

const scanlines = (w: number, h: number) => {
    const { canvas, ctx } = makeCanvas(w, h);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c4c4c4';
    for (let y = 0; y < h; y += 2) ctx.fillRect(0, y, w, 1);
    return canvas;
};

const containerRibs = (w: number, h: number, seed: number) => {
    const canvas = grime(w, h, seed, 0.55);
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    for (let sx = 0; sx < w; sx += 7) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(sx, 0, 3, h); }
    return canvas;
};

/** A peeled corner and scuffs: small patches in the container colour over the sticker. */
const peel = (w: number, h: number, seed: number) => {
    const { canvas, ctx } = makeCanvas(w, h);
    const r = rnd(seed);
    ctx.fillStyle = DECAL_CONTAINER.color;
    ctx.beginPath(); ctx.moveTo(w, 0); ctx.lineTo(w - 9, 0); ctx.lineTo(w, 7); ctx.fill();
    for (let i = 0; i < 24; i++) ctx.fillRect(r() < 0.5 ? r() * 5 : w - r() * 5, r() * h, 1 + r() * 3, 1 + r() * 3);
    return canvas;
};

export const buildAdPlace = (p: AdPlace): AdPlaceView => {
    const root = new Container();
    const textures = houseAds()[p.size].map(c => bakedTexture(c));
    const creatives = textures.map(t => { const s = new Sprite(t); s.position.set(p.x, p.y); s.width = p.w; s.height = p.h; return s; });
    creatives.forEach((s, i) => { s.alpha = i === 0 ? 1 : 0; });

    if (p.kind === 'lightbox') {
        root.addChild(sprite(lightboxFrame(p), p.x - GLOW_PAD, p.y - GLOW_PAD));
        creatives.forEach(s => { s.tint = 0xc4ccd6; root.addChild(s); });
        const g = sprite(grime(p.w, p.h, 7, 0.35), p.x, p.y); g.blendMode = 'multiply'; root.addChild(g);
        const sh = sprite(sheen(p.w, p.h), p.x, p.y); sh.blendMode = 'add'; root.addChild(sh);
    } else if (p.kind === 'decal') {
        const c = DECAL_CONTAINER;
        root.addChild(sprite(bakeContainer(p.w + c.padX * 2, p.h + c.padTop + c.padBottom, c.color, c.label, true), p.x - c.padX, p.y - c.padTop));
        creatives.forEach(s => { s.tint = 0xcbbfa6; s.alpha = 0.88; root.addChild(s); });
        const ribs = sprite(containerRibs(p.w, p.h, 13), p.x, p.y); ribs.blendMode = 'multiply'; root.addChild(ribs);
        root.addChild(sprite(peel(p.w, p.h, 17), p.x, p.y));
    } else {
        root.addChild(sprite(screenBezel(p), p.x - 4, p.y - 26));
        creatives.forEach(s => { s.tint = 0xc0d0d8; root.addChild(s); });
        const lines = sprite(scanlines(p.w, p.h), p.x, p.y); lines.blendMode = 'multiply'; root.addChild(lines);
        const sh = sprite(sheen(p.w, p.h), p.x, p.y); sh.blendMode = 'add'; root.addChild(sh);
    }
    return { place: p, root, creatives };
};

/** Screens slowly cross-fade between their creatives; nothing flashes. */
export const updateAdPlace = (view: AdPlaceView, now: number) => {
    const n = view.creatives.length;
    if (n < 2) return;
    const i = Math.floor(now / SCREEN_PERIOD_MS) % n;
    const into = now % SCREEN_PERIOD_MS - (SCREEN_PERIOD_MS - CROSSFADE_MS);
    const fade = Math.max(0, Math.min(1, into / CROSSFADE_MS));
    view.creatives.forEach((s, k) => { s.alpha = k === i ? 1 - fade : k === (i + 1) % n ? fade : 0; });
};
