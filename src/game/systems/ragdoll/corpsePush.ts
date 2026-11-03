// Later explosions push the corpses lying around (as in Soldat): lying bodies are thrown again.
// Pure math on the corpse data, display side only (from EFFECT explosion events).

import { Corpse } from './corpseBody';
import { fitSpeedCap, kick, MOCKUP_VELOCITY } from './corpseLaunch';

/** An explosion pushes corpse points within this radius × its size, fading to nothing at the edge. */
const PUSH_RADIUS = 150;
const PUSH_POWER = 13 * MOCKUP_VELOCITY;
/** Upward share of a later blast's push, more than a launch's lift: a lying body on the floor hops instead of only sliding. */
const PUSH_LIFT = 1;
/** Closer than this to a blast centre a point has no direction: it is pushed straight up. */
const MIN_DIST = 0.001;

/**
 * A later explosion at (x, y) pushes every corpse point within its reach; lying bodies are thrown again.
 * A corpse born this tick is left alone: a rocket's direct hit kills before its own blast goes off,
 * and the gib launch already scatters that corpse away from it.
 */
export const pushCorpses = (corpses: Corpse[], x: number, y: number, size = 1): void => {
    const radius = PUSH_RADIUS * size;
    for (const c of corpses) {
        if (c.age === 0) continue;
        let touched = false;
        for (const p of Object.values(c.points)) {
            const dx = p.x - x, dy = p.y - y;
            const d = Math.hypot(dx, dy);
            if (d >= radius) continue;
            const f = PUSH_POWER * size * (1 - d / radius);
            touched = true;
            if (d < MIN_DIST) { kick(p, 0, -f); continue; }
            kick(p, dx / d * f, dy / d * f - f * PUSH_LIFT);
        }
        if (touched) fitSpeedCap(c);
    }
};
