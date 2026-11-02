// Scorch marks drawn over the platform art: dark soot dots where sparks hit a wall or floor.
// The marks themselves live in systems/marks.ts; this only paints them, fading out with age.

import { Graphics } from 'pixi.js';
import { liveMarks, MARK_LIFE_MS } from '../../systems/marks';

const MARK_COLOR = 0x0a0c10;
const MARK_ALPHA = 0.6;

/** Redraw every live mark onto `g` (cleared first); alpha runs from MARK_ALPHA down to 0 over MARK_LIFE_MS. */
export const drawMarks = (g: Graphics, now: number): void => {
    g.clear();
    for (const m of liveMarks(now)) {
        const alpha = MARK_ALPHA * (1 - (now - m.bornAt) / MARK_LIFE_MS);
        g.circle(m.x, m.y, m.r).fill({ color: MARK_COLOR, alpha });
    }
};
