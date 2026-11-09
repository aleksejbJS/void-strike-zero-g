// The warning over a fighter whose fuel tank is lit: a big hazard triangle that blinks faster and faster as the
// blast nears, a ring pulsing out of it on every blink, a fuse bar under it that burns down to the blast, and a
// red-orange glow pulsing over the whole fighter. Everyone sees it, so the blast never comes as a surprise, and
// nothing about it looks like an ordinary burning body. Drawn in the player's container (origin at the feet).

import { Graphics, Sprite } from 'pixi.js';
import { Entity } from '../../types';
import { TANK_FUSE_MS } from '../systems/flameConstants';

/** Blinks per second when the tank lights and right before it blows. */
const BLINK_START_HZ = 2.5;
const BLINK_END_HZ = 12;
const ABOVE_HEAD = 46;   // px from the top of the hitbox to the triangle's middle
const SIDE = 38;         // triangle side, px
const OUTLINE = 3;
const RING = { from: 18, to: 36, width: 3 }; // px: the pulse ring's radius at the start and end of a blink
const BACKDROP_R = 24;   // px: the dark disc that lifts the triangle off any background
const BAR_W = 42;
const BAR_H = 5;
const BAR_GAP = 6;       // px between the triangle and the fuse bar
const DIM_ALPHA = 0.45;
const YELLOW = 0xfacc15;
const INK = 0x111111;
const FUSE = 0xef4444;
const RING_COLOR = 0xff4d1a;
/** The glow over the fighter: its colour, its size against the fighter's height and its faintest and brightest alpha. */
const HALO_COLOR = 0xff4a14;
const HALO_SIZE = 2.3;
const HALO_ALPHA = { min: 0.3, max: 0.9 };

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Share of the fuse that has burnt (0 just lit, 1 at the blast); undefined when no tank is lit. */
export const fuseBurnt = (p: Pick<Entity, 'tankFuseAt'>, now: number): number | undefined =>
    typeof p.tankFuseAt === 'number' && Number.isFinite(p.tankFuseAt)
        ? clamp01(1 - (p.tankFuseAt - now) / TANK_FUSE_MS)
        : undefined;

/**
 * How many blinks have passed (the fraction is how far into the current one). The blink rate rises evenly from
 * BLINK_START_HZ to BLINK_END_HZ over the fuse; the phase is that rate summed over time, so the blink never jumps.
 */
export const blinkPhase = (burnt: number): number => {
    const t = (burnt * TANK_FUSE_MS) / 1000;
    const total = TANK_FUSE_MS / 1000;
    return BLINK_START_HZ * t + ((BLINK_END_HZ - BLINK_START_HZ) * t * t) / (2 * total);
};

/** Is the triangle in its bright half of a blink? */
export const warningLit = (burnt: number): boolean => blinkPhase(burnt) % 1 < 0.5;

/** Redraw the warning for this frame; nothing is drawn while the tank is not lit. */
export const drawTankWarning = (g: Graphics, p: Pick<Entity, 'tankFuseAt' | 'height'>, now: number): void => {
    g.clear();
    const burnt = fuseBurnt(p, now);
    if (burnt === undefined) return;
    const pulse = blinkPhase(burnt) % 1;
    const alpha = pulse < 0.5 ? 1 : DIM_ALPHA;
    const cy = -p.height - ABOVE_HEAD;
    const h = (SIDE * Math.sqrt(3)) / 2;
    // A ring flies out of the triangle on every blink
    g.circle(0, cy, RING.from + (RING.to - RING.from) * pulse).stroke({ color: RING_COLOR, width: RING.width, alpha: 0.9 * (1 - pulse) });
    g.circle(0, cy + 2, BACKDROP_R).fill({ color: INK, alpha: 0.35 });
    g.poly([0, cy - h / 2, SIDE / 2, cy + h / 2, -SIDE / 2, cy + h / 2])
        .fill({ color: YELLOW, alpha })
        .stroke({ color: INK, width: OUTLINE, alpha, join: 'round' });
    // The exclamation mark
    g.roundRect(-2.25, cy - h / 2 + 9, 4.5, h - 19, 2).fill({ color: INK, alpha });
    g.circle(0, cy + h / 2 - 5, 2.6).fill({ color: INK, alpha });
    // Fuse bar: what is left of the 3 s
    const barY = cy + h / 2 + BAR_GAP;
    g.roundRect(-BAR_W / 2 - 1, barY - 1, BAR_W + 2, BAR_H + 2, 2).fill({ color: INK, alpha: 0.7 });
    g.rect(-BAR_W / 2, barY, BAR_W * (1 - burnt), BAR_H).fill({ color: FUSE });
};

/** The red-orange glow pulsing over a fighter whose tank is lit (an additive glow sprite); hidden otherwise. */
export const placeTankHalo = (s: Sprite, p: Pick<Entity, 'tankFuseAt' | 'height'>, now: number): void => {
    const burnt = fuseBurnt(p, now);
    s.visible = burnt !== undefined;
    if (burnt === undefined) return;
    const glow = 0.5 + 0.5 * Math.cos(2 * Math.PI * blinkPhase(burnt)); // brightest as each blink starts
    s.tint = HALO_COLOR;
    s.alpha = HALO_ALPHA.min + (HALO_ALPHA.max - HALO_ALPHA.min) * glow;
    s.width = s.height = p.height * HALO_SIZE;
    s.position.set(0, -p.height / 2);
};
