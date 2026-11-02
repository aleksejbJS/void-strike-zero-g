// The pieces of a torn corpse (gib pieces and railgun halves), drawn in the same style as the fighter.
// Each piece is drawn once around its own origin in rig units; the corpse view places, turns and scales it.

import { Graphics } from 'pixi.js';
import { DEFAULT_BUILD } from '../build/buildParts';
import type { RagdollColors } from '../systems/events';
import { FighterLook, lookFromSetup, shade } from './fighter/fighterLook';
import { boot, jointedLimb, plate, shoulderPad } from './fighter/fighterParts';
import { drawHead } from './fighter/parts/helmets';
import { drawEars } from './fighter/parts/ears';
import { drawPattern } from './fighter/parts/patterns';
import { drawBadge } from './fighter/parts/badges';
import { IDLE_PARTS } from './fighter/parts/partMotionFrame';
import { BELT, dot } from './fighter/fighterPaint';
import { LIMB_W, TORSO_W } from './fighter/fighterStyle';
import type { CorpsePiece } from './ragdoll/corpsePose';
import { drawLegsHalf, drawUpperHalf } from './ragdoll/cutHalves';
import { tornEnd } from './ragdoll/tornFlesh';

// Fighter torso points are relative to the hip, which sits 9.5 units below the middle of the torso piece.
const HIP_BELOW_CENTER = 9.5;
/** Where the neck was, seen from the middle of the head (the standing fighter's head sits 2.2 forward of it). */
const NECK_FROM_HEAD = { x: -2.2, y: 8.5 };

/**
 * The corpse's colours on the fighter's slots, with the build it was cut from. Older hosts may send
 * no colours (white body, default legs and jetpack) or no build (the default build).
 */
export const lookOfCorpse = (colors?: RagdollColors): FighterLook => lookFromSetup(
    { head: colors?.head ?? '', torso: colors?.torso ?? '', arms: colors?.arm ?? '', legs: colors?.leg ?? '', jetpack: colors?.jet ?? '' },
    colors?.build ?? DEFAULT_BUILD,
);

/** Head with its ears and helmet around the middle of the head; torn at the neck. */
const drawHeadPiece = (g: Graphics, look: FighterLook) => {
    drawEars(g, look, IDLE_PARTS); // behind the head, as on the living fighter
    drawHead(g, look);
    tornEnd(g, NECK_FROM_HEAD);
};

/** The torso around its middle, with pattern, belt, shoulder pad and badge; torn at the neck and the hip. */
const drawTorsoPiece = (g: Graphics, look: FighterLook) => {
    const T = (x: number, y: number) => ({ x: x * TORSO_W, y });
    // Fighter torso points sit on the hip frame; the piece's middle is 9.5 units above the hip
    const fromHip = (x: number, y: number) => ({ x: x * TORSO_W, y: y + HIP_BELOW_CENTER });
    const onPad = (x: number, y: number) => ({ x, y: y + HIP_BELOW_CENTER });
    plate(g, [T(-6.2, 10), T(6.2, 10), T(7.6, -10), T(-6.6, -10)], look.torso);
    drawPattern(g, fromHip, look);
    plate(g, [T(-6.4, 8), T(6.4, 8), T(6.3, 11), T(-6.3, 11)], BELT);
    shoulderPad(g, onPad, look.torso);
    drawBadge(g, onPad, look);
    tornEnd(g, { x: 0, y: -HIP_BELOW_CENTER });
    tornEnd(g, { x: 0, y: HIP_BELOW_CENTER });
};

/** An arm hanging from its elbow (upper arm straight up), torn at the shoulder. */
const drawArmPiece = (g: Graphics, color: number) => {
    jointedLimb(g, { x: 0, y: -10 }, { x: 0, y: 0 }, { x: 3, y: 9 }, { widths: [4.8 * LIMB_W, 4.4 * LIMB_W], colors: [color, shade(color, 0.92)] });
    dot(g, { x: 3, y: 9 }, 2.3, 0x2b3038);
    tornEnd(g, { x: 0, y: -10 });
};

/** A leg standing on its knee (thigh up, shin down), torn at the hip. */
const drawLegPiece = (g: Graphics, color: number) => {
    jointedLimb(g, { x: 0, y: -14 }, { x: 0, y: 0 }, { x: 0, y: 12 }, { widths: [6.4 * LIMB_W, 5.6 * LIMB_W], colors: [color, shade(color, 0.9)] });
    boot(g, { x: 0, y: 12 }, 0x252a32);
    tornEnd(g, { x: 0, y: -14 });
};

/** Draw one piece of a torn corpse once, around its own origin (rig units, facing right). */
export const drawRagdollShape = (g: Graphics, part: CorpsePiece['part'], colors?: RagdollColors) => {
    const look = lookOfCorpse(colors);
    switch (part) {
        case 'head': return drawHeadPiece(g, look);
        case 'torso': return drawTorsoPiece(g, look);
        case 'upper': return drawUpperHalf(g, look);
        case 'legs': return drawLegsHalf(g, look);
        case 'arm-front':
        case 'arm-back': return drawArmPiece(g, look.arm);
        case 'leg-front':
        case 'leg-back': return drawLegPiece(g, look.leg);
    }
};
