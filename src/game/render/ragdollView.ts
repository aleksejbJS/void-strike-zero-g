// Body parts flying apart after a death, drawn in the same style as the fighter.

import { Graphics } from 'pixi.js';
import { RagdollPart } from '../../types';
import { RIG_SCALE } from './fighter/fighterPose';
import { shade } from './fighter/fighterLook';
import { boot, dot, limb, plate } from './fighter/fighterParts';

const toNumber = (color: string) => /^#[0-9a-f]{6}$/i.test(color) ? parseInt(color.slice(1), 16) : 0xffffff;

/** Move, turn and fade a part each frame. */
export const placeRagdollPart = (g: Graphics, part: RagdollPart) => {
    g.position.set(part.pos.x, part.pos.y);
    g.rotation = part.rotation;
    g.alpha = Math.min(1, part.life / 2); // fade out in the last 2 seconds
};

/** Draw a part once, around its own center (rig units, scaled like a living fighter). */
export const drawRagdollShape = (g: Graphics, part: RagdollPart) => {
    g.scale.set(RIG_SCALE);
    const color = toNumber(part.color);
    switch (part.type) {
        case 'head':
            dot(g, { x: 0, y: 0 }, 7, color);
            g.roundRect(1, -3, 7.4, 5.4, 2.4).fill(0x0e1116);
            break;
        case 'torso':
            plate(g, [{ x: -6.2, y: 10 }, { x: 6.2, y: 10 }, { x: 7.6, y: -10 }, { x: -6.6, y: -10 }], color);
            plate(g, [{ x: -6.4, y: 8 }, { x: 6.4, y: 8 }, { x: 6.3, y: 11 }, { x: -6.3, y: 11 }], 0x1a1d21);
            break;
        case 'arm-left':
        case 'arm-right':
            limb(g, { x: 0, y: -10 }, { x: 0, y: 0 }, 4.8, color);
            limb(g, { x: 0, y: 0 }, { x: 3, y: 9 }, 4.4, shade(color, 0.92));
            dot(g, { x: 3, y: 9 }, 2.3, 0x2b3038);
            break;
        case 'leg-left':
        case 'leg-right':
            limb(g, { x: 0, y: -14 }, { x: 0, y: 0 }, 6.4, color);
            limb(g, { x: 0, y: 0 }, { x: 0, y: 12 }, 5.6, shade(color, 0.9));
            boot(g, { x: 0, y: 12 }, 0x252a32);
            break;
    }
};
