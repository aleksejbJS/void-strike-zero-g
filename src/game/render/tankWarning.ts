// The warning over a fighter whose fuel tank is lit: a hazard triangle that blinks faster and faster as the
// blast nears, with a fuse bar under it that burns down to the blast. Everyone sees it, so the blast never
// comes as a surprise. Drawn in the player's container, whose origin is the fighter's feet.

import { Graphics } from 'pixi.js';
import { Entity } from '../../types';
import { TANK_FUSE_MS } from '../systems/flameConstants';

/** Blinks per second when the tank lights and right before it blows. */
const BLINK_START_HZ = 2.5;
const BLINK_END_HZ = 12;
const ABOVE_HEAD = 30;   // px from the top of the hitbox to the triangle's middle
const SIDE = 22;         // triangle side, px
const BAR_W = 28;
const BAR_H = 3;
const BAR_GAP = 5;       // px between the triangle and the fuse bar
const DIM_ALPHA = 0.35;
const YELLOW = 0xfacc15;
const INK = 0x111111;
const FUSE = 0xef4444;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Share of the fuse that has burnt (0 just lit, 1 at the blast); undefined when no tank is lit. */
export const fuseBurnt = (p: Pick<Entity, 'tankFuseAt'>, now: number): number | undefined =>
    typeof p.tankFuseAt === 'number' && Number.isFinite(p.tankFuseAt)
        ? clamp01(1 - (p.tankFuseAt - now) / TANK_FUSE_MS)
        : undefined;

/**
 * Is the triangle in its bright half of a blink? The blink rate rises evenly from BLINK_START_HZ to
 * BLINK_END_HZ over the fuse; the phase is that rate summed over time, so the blink never jumps.
 */
export const warningLit = (burnt: number): boolean => {
    const t = (burnt * TANK_FUSE_MS) / 1000;
    const total = TANK_FUSE_MS / 1000;
    const phase = BLINK_START_HZ * t + ((BLINK_END_HZ - BLINK_START_HZ) * t * t) / (2 * total);
    return phase % 1 < 0.5;
};

/** Redraw the warning for this frame; nothing is drawn while the tank is not lit. */
export const drawTankWarning = (g: Graphics, p: Pick<Entity, 'tankFuseAt' | 'height'>, now: number): void => {
    g.clear();
    const burnt = fuseBurnt(p, now);
    if (burnt === undefined) return;
    const alpha = warningLit(burnt) ? 1 : DIM_ALPHA;
    const cy = -p.height - ABOVE_HEAD;
    const h = (SIDE * Math.sqrt(3)) / 2;
    g.poly([0, cy - h / 2, SIDE / 2, cy + h / 2, -SIDE / 2, cy + h / 2])
        .fill({ color: YELLOW, alpha })
        .stroke({ color: INK, width: 2, alpha, join: 'round' });
    // The exclamation mark
    g.rect(-1.5, cy - h / 2 + 6, 3, h - 12).fill({ color: INK, alpha });
    g.circle(0, cy + h / 2 - 3.5, 1.7).fill({ color: INK, alpha });
    // Fuse bar: what is left of the 3 s
    const barY = cy + h / 2 + BAR_GAP;
    g.rect(-BAR_W / 2, barY, BAR_W, BAR_H).fill({ color: INK, alpha: 0.6 });
    g.rect(-BAR_W / 2, barY, BAR_W * (1 - burnt), BAR_H).fill({ color: FUSE });
};
