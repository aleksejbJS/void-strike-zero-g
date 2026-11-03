// The smoke launcher lying on the map: the grenade launcher's shape in grey, with a small puff
// at the muzzle. Drawn in the pickup's local space (origin at the item, y up is negative).

import { Graphics } from 'pixi.js';

const BODY = 0x4b5563, DRUM_CORE = 0xd1d5db, SIGHT = 0x1e293b, PUFF = 0xe5e7eb;

/** Paint the pickup into `g`; `color` is the weapon colour (grey). */
export const drawSmokeLauncherPickup = (g: Graphics, color: number | string): void => {
    g.rect(-15, -16, 28, 10).fill(BODY);
    g.circle(13, -11, 8).fill(color);
    g.circle(13, -11, 5).fill(DRUM_CORE);
    g.rect(-12, -13, 4, 4).fill(SIGHT);
    // The puff: three overlapping wisps rising off the muzzle
    g.circle(22, -18, 4).fill({ color: PUFF, alpha: 0.75 });
    g.circle(26, -22, 3).fill({ color: PUFF, alpha: 0.6 });
    g.circle(21, -24, 3).fill({ color: PUFF, alpha: 0.5 });
};
