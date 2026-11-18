// Procedural anatomy remains the fallback while illustrated body textures are unavailable.
import type { Graphics } from 'pixi.js';
import type { FighterPose } from './fighterPose';
import { FighterLook, shade } from './fighterLook';
import { boot, drawTorso, jointedLimb } from './fighterParts';
import { drawStump } from './fighterStump';
import { LIMB_W } from './fighterStyle';

export const drawLegacyBody = (g: Graphics, pose: FighterPose, look: FighterLook, oneLeg = false): void => {
    const legDark = shade(look.leg, 0.72);
    if (oneLeg) drawStump(g, pose, look);
    else {
        jointedLimb(g, pose.hip, pose.backLeg.joint, pose.backLeg.end,
            { widths: [6.2 * LIMB_W, 5.4 * LIMB_W], colors: [legDark, legDark] });
        boot(g, pose.backLeg.end, 0x1b1f25);
    }
    const armDark = shade(look.arm, 0.72);
    jointedLimb(g, pose.shoulderBack, pose.backArm.joint, pose.backArm.end,
        { widths: [4.6 * LIMB_W, 4.2 * LIMB_W], colors: [armDark, armDark] });
    drawTorso(g, pose, look);
    jointedLimb(g, pose.hip, pose.frontLeg.joint, pose.frontLeg.end,
        { widths: [6.4 * LIMB_W, 5.6 * LIMB_W], colors: [look.leg, shade(look.leg, 0.9)] });
    boot(g, pose.frontLeg.end, 0x252a32);
};
