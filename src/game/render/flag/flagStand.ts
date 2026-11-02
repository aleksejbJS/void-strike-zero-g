// What a flag stands on: the heavy plinth at a CTF base (steel, hazard tape, team light
// strip, floor glow) and the ring that marks a dropped flag. Origin = floor under the pole.

import { Graphics, Sprite } from 'pixi.js';
import { glowTexture } from '../effects/glowTextures';
import { FlagPalette, mixColor } from './flagPalette';

export const PLINTH_HEIGHT = 23; // pole foot above the floor

const STEEL_TOP = 0x5a636e;
const STEEL_BOTTOM = 0x22272d;
const TAPE_DARK = 0x14171b;
const TAPE_YELLOW = 0xfacc15;

/** Static body of the plinth: a 92 → 72 px trapezoid, 20 px tall, with a band of hazard tape. */
export const drawPlinth = (g: Graphics) => {
    g.poly([-46, 0, 46, 0, 36, -20, -36, -20]).fill(STEEL_BOTTOM);
    g.poly([-41, -10, 41, -10, 36, -20, -36, -20]).fill(STEEL_TOP);
    g.rect(-40, -12, 80, 7).fill(TAPE_DARK);
    for (let x = -40; x <= 26; x += 12) g.poly([x, -5, x + 6, -5, x + 13, -12, x + 7, -12]).fill(TAPE_YELLOW);
    g.rect(-46, -1, 92, 1).fill({ color: 0x000000, alpha: 0.5 });
};

/** Team light strip on top of the plinth; pulses through its alpha. */
export const drawPlinthLight = (g: Graphics, pal: FlagPalette) => {
    g.rect(-34, -PLINTH_HEIGHT, 68, 3).fill(mixColor(pal.main, pal.light, 0.3));
};

/** Ellipse on the floor around a dropped flag; pulses through its alpha. */
export const drawDropRing = (g: Graphics, pal: FlagPalette) => {
    g.ellipse(0, 0, 42, 8).stroke({ width: 3, color: pal.light });
};

/** Soft glow squashed onto the floor under the plinth. */
export const makeFloorGlow = (pal: FlagPalette): Sprite => {
    const s = new Sprite(glowTexture());
    s.anchor.set(0.5);
    s.blendMode = 'add';
    s.width = 140;
    s.height = 28;
    s.tint = pal.main;
    return s;
};
