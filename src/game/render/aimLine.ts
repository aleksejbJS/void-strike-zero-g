// Touch aiming: a dashed line from the fighter to the aim point while the aim stick is held,
// so the player sees where the shots go without a finger over the target. Window pixels.

import { Graphics } from 'pixi.js';
import { Vector2 } from '../../types';

const COLOR = 0xffc21a;
const DASH = 6;
const GAP = 6;
const START_GAP = 18; // keep clear of the fighter's own body

export const drawAimLine = (g: Graphics, from: Vector2 | null, to: Vector2 | null) => {
    g.clear();
    if (!from || !to) return;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length <= START_GAP) return;
    const ux = dx / length;
    const uy = dy / length;
    for (let d = START_GAP; d < length; d += DASH + GAP) {
        const end = Math.min(length, d + DASH);
        g.moveTo(from.x + ux * d, from.y + uy * d).lineTo(from.x + ux * end, from.y + uy * end);
    }
    g.stroke({ width: 2, color: COLOR, alpha: 0.75 });
    g.circle(to.x, to.y, 6).stroke({ width: 2, color: COLOR, alpha: 0.9 });
};
