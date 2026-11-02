// Body parts flying apart after a death, drawn in the same style as the fighter.

import { Graphics } from 'pixi.js';
import { DEFAULT_BUILD, FighterBuild } from '../build/buildParts';
import { RIG_SCALE } from './fighter/fighterPose';
import { FighterLook, lookFromSetup, shade } from './fighter/fighterLook';
import { boot, jointedLimb, plate, shoulderPad } from './fighter/fighterParts';
import { drawHead } from './fighter/parts/helmets';
import { drawEars } from './fighter/parts/ears';
import { drawPattern } from './fighter/parts/patterns';
import { drawBadge } from './fighter/parts/badges';
import { IDLE_PARTS } from './fighter/parts/partMotionFrame';
import { dot } from './fighter/fighterPaint';
import { LIMB_W, TORSO_W } from './fighter/fighterStyle';

// Fighter torso points are relative to the hip, which sits 9.5 units below the middle of the ragdoll torso.
const HIP_BELOW_CENTER = 9.5;

/** One body part to draw: which part, its colour and the build it was cut from. Task 5 replaces this view. */
export interface RagdollPart {
    type: 'head' | 'torso' | 'arm-left' | 'arm-right' | 'leg-left' | 'leg-right';
    color: string;
    build?: FighterBuild;
}

const toNumber = (color: string) => /^#[0-9a-f]{6}$/i.test(color) ? parseInt(color.slice(1), 16) : 0xffffff;

/** The part's colour on every slot, with the build it was cut from (the default build when it has none). */
const lookOf = (part: RagdollPart): FighterLook => {
    const c = part.color;
    return lookFromSetup({ head: c, torso: c, arms: c, legs: c, jetpack: c }, part.build ?? DEFAULT_BUILD);
};

/** Draw a part once, around its own center (rig units, scaled like a living fighter). */
export const drawRagdollShape = (g: Graphics, part: RagdollPart) => {
    g.scale.set(RIG_SCALE);
    const color = toNumber(part.color);
    const T = (x: number, y: number) => ({ x: x * TORSO_W, y });
    switch (part.type) {
        case 'head': {
            const look = lookOf(part);
            drawEars(g, look, IDLE_PARTS); // behind the head, as on the living fighter
            drawHead(g, look);
            break;
        }
        case 'torso': {
            const look = lookOf(part);
            // Fighter torso points sit on the hip frame; the ragdoll's middle is 9.5 units above the hip
            const fromHip = (x: number, y: number) => ({ x: x * TORSO_W, y: y + HIP_BELOW_CENTER });
            const onPad = (x: number, y: number) => ({ x, y: y + HIP_BELOW_CENTER });
            plate(g, [T(-6.2, 10), T(6.2, 10), T(7.6, -10), T(-6.6, -10)], color);
            drawPattern(g, fromHip, look);
            plate(g, [T(-6.4, 8), T(6.4, 8), T(6.3, 11), T(-6.3, 11)], 0x1a1d21);
            shoulderPad(g, onPad, color);
            drawBadge(g, onPad, look);
            break;
        }
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
