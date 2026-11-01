// Station lighting: hanging lamps over the widest decks (warm cones that flicker a little),
// rotating red beacons on the girders, and the screen-space vignette and film grain.

import { Container, Sprite, TilingSprite } from 'pixi.js';
import { Platform } from '../../../types';
import { glow, makeCanvas, noise } from './canvasKit';
import { bakedTexture } from './bakedTextures';

const MAX_LAMPS = 6;
const LAMP_HANG = 230;   // lamp height above the deck it lights
const CONE_H = 300;

export interface Lamp { cone: Sprite; phase: number }

const lampHousing = () => {
    const { canvas, ctx } = makeCanvas(40, 420);
    ctx.fillStyle = '#0b0e12'; ctx.fillRect(19, 0, 2, 410);                         // rod up into the dark
    ctx.fillStyle = '#20272f';
    ctx.beginPath(); ctx.moveTo(4, 420); ctx.lineTo(36, 420); ctx.lineTo(29, 411); ctx.lineTo(11, 411); ctx.fill();
    ctx.fillStyle = '#ffe1a8'; ctx.fillRect(11, 417, 18, 3);
    return canvas;
};

const lampCone = () => {
    const { canvas, ctx } = makeCanvas(280, CONE_H + 60);
    const g = ctx.createLinearGradient(0, 0, 0, CONE_H);
    g.addColorStop(0, 'rgba(255,196,120,0.16)'); g.addColorStop(1, 'rgba(255,196,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(130, 0); ctx.lineTo(150, 0); ctx.lineTo(260, CONE_H); ctx.lineTo(20, CONE_H); ctx.fill();
    glow(ctx, 140, 4, 46, '#ffc070', 0.55);
    return canvas;
};

/** Lamps hang over the widest decks, so the light lands where fighters stand. */
export const buildLamps = (platforms: Platform[], layer: Container): Lamp[] => {
    const housing = bakedTexture(lampHousing());
    const cone = bakedTexture(lampCone());
    const decks = platforms
        .filter(p => p.h < 100 && p.w >= 200 && p.w <= 1200)
        .sort((a, b) => b.w - a.w)
        .slice(0, MAX_LAMPS);
    return decks.map((p, i) => {
        const x = p.x + p.w / 2, y = p.y - LAMP_HANG;
        const h = new Sprite(housing); h.position.set(x - 20, y - 420); layer.addChild(h);
        const c = new Sprite(cone); c.position.set(x - 140, y); c.blendMode = 'add'; layer.addChild(c);
        return { cone: c, phase: i * 1.7 };
    });
};

export const updateLamps = (lamps: Lamp[], t: number) => {
    for (const l of lamps) l.cone.alpha = 0.92 + 0.08 * Math.sin(t * 13 + l.phase * 5) * Math.sin(t * 7.3 + l.phase);
};

export interface Beacon { beam: Sprite }

const beaconBeam = () => {
    const { canvas, ctx } = makeCanvas(170, 70);
    const g = ctx.createLinearGradient(0, 0, 170, 0);
    g.addColorStop(0, 'rgba(255,60,40,0.35)'); g.addColorStop(1, 'rgba(255,60,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 35); ctx.lineTo(170, 5); ctx.lineTo(170, 65); ctx.fill();
    glow(ctx, 6, 35, 22, '#ff4d2e', 0.7);
    ctx.fillStyle = '#ff4d2e'; ctx.beginPath(); ctx.arc(6, 35, 3.5, 0, Math.PI * 2); ctx.fill();
    return canvas;
};

export const buildBeacons = (layer: Container, spots: [number, number][]): Beacon[] => {
    const tex = bakedTexture(beaconBeam());
    return spots.map(([x, y]) => {
        const beam = new Sprite(tex);
        beam.anchor.set(6 / 170, 0.5);
        beam.position.set(x, y);
        beam.blendMode = 'add';
        layer.addChild(beam);
        return { beam };
    });
};

export const updateBeacons = (beacons: Beacon[], t: number) => {
    beacons.forEach((b, i) => { b.beam.rotation = (t * 3 + i * 2) % (Math.PI * 2); });
};

/** Vignette and a faint grain over the whole view (screen space). */
export const buildPostFx = () => {
    const root = new Container();
    const { canvas, ctx } = makeCanvas(512, 512);
    const v = ctx.createRadialGradient(256, 256, 150, 256, 256, 362);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, 512, 512);
    const vignette = new Sprite(bakedTexture(canvas));
    const grain = new TilingSprite({ texture: bakedTexture(noise(256, 256, 2, 31, 1)), width: 1, height: 1 });
    grain.alpha = 0.05;
    root.addChild(vignette, grain);
    root.eventMode = 'none';
    const resize = (w: number, h: number) => {
        vignette.width = w; vignette.height = h;
        grain.width = w; grain.height = h;
    };
    const update = (t: number) => { grain.tilePosition.set((t * 977) % 256, (t * 613) % 256); };
    return { root, resize, update };
};
