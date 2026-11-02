// Body parts flying apart after a death, drawn in the same style as the fighter.

import { Graphics } from 'pixi.js';
import { RagdollPart } from '../../types';
import { RIG_SCALE } from './fighter/fighterPose';
import { shade } from './fighter/fighterLook';
import { boot, jointedLimb, plate, shoulderPad } from './fighter/fighterParts';
import { helmetRidge } from './fighter/parts/helmets';
import { drawSpecular, drawVisor } from './fighter/fighterDetails';
import { dot } from './fighter/fighterPaint';
import { HEAD_R, LIMB_W, TORSO_W } from './fighter/fighterStyle';

// Fighter torso points are relative to the hip, which sits 9.5 units below the middle of the ragdoll torso.
const HIP_BELOW_CENTER = 9.5;

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
    const T = (x: number, y: number) => ({ x: x * TORSO_W, y });
    switch (part.type) {
        case 'head':
            dot(g, { x: 0, y: 0 }, HEAD_R, color);
            drawSpecular(g, HEAD_R);
            helmetRidge(g);
            drawVisor(g, HEAD_R);
            break;
        case 'torso':
            plate(g, [T(-6.2, 10), T(6.2, 10), T(7.6, -10), T(-6.6, -10)], color);
            plate(g, [T(-6.4, 8), T(6.4, 8), T(6.3, 11), T(-6.3, 11)], 0x1a1d21);
            shoulderPad(g, (x, y) => ({ x, y: y + HIP_BELOW_CENTER }), color);
            break;
        case 'arm-left':
        case 'arm-right':
            jointedLimb(g, { x: 0, y: -10 }, { x: 0, y: 0 }, { x: 3, y: 9 }, { widths: [4.8 * LIMB_W, 4.4 * LIMB_W], colors: [color, shade(color, 0.92)] });
            dot(g, { x: 3, y: 9 }, 2.3, 0x2b3038);
            break;
        case 'leg-left':
        case 'leg-right':
            jointedLimb(g, { x: 0, y: -14 }, { x: 0, y: 0 }, { x: 0, y: 12 }, { widths: [6.4 * LIMB_W, 5.6 * LIMB_W], colors: [color, shade(color, 0.9)] });
            boot(g, { x: 0, y: 12 }, 0x252a32);
            break;
    }
};
