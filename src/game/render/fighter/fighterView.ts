// A fighter on screen: Pixi layers (flame glow, body, head, weapon, muzzle light, front arm) redrawn from a pose each frame.

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { WeaponType } from '../../../types';
import { FighterPose, RIG_SCALE, upperPoint } from './fighterPose';
import { FighterLook, flashLook, shade } from './fighterLook';
import { FLAME_BASE, boot, drawFlame, drawHead, drawJetpack, drawTail, drawTorso, flameLength, hand, headKeyOf, jointedLimb } from './fighterParts';
import { LIMB_W } from './fighterStyle';
import { glowTexture } from '../effects/glowTextures';
import { GripPoints } from './weaponGrips';
import { createMuzzleLight, drawMuzzle, muzzlePoint } from './muzzleFlash';

export interface FighterView {
    root: Container;
    flameGlow: Sprite; // soft orange light behind the body, shown while the flame burns
    body: Graphics;    // jetpack, legs, back arm, torso
    head: Graphics;
    weapon: Sprite;
    light: Sprite;     // warm muzzle light, over the body and weapon, under the front arm
    front: Graphics;   // hands and the front arm, over the weapon
    headKey: string;   // look the head was drawn for
}

export interface FighterFrame {
    pose: FighterPose;
    look: FighterLook;
    facing: number;    // 1 right, -1 left
    grip: GripPoints;
    weapon?: Texture;
    weaponType: WeaponType; // picks the size of the muzzle flash
    flame: boolean;
    flicker: number;   // 0..1, flame length jitter
    tailSwing: number; // -1..1
    muzzleFlash: number; // 0..1, strength of the flash (0 = none)
    squash?: number;   // 0..1, landing squash (default 0)
    headBob?: number;  // radians added to the head tilt (default 0)
    hitFlash?: number; // 0..1, brightens the colours after a hit (default 0)
}

const FALLBACK_GUN = 0x1e293b;
const FLAME_GLOW_TINT = 0xff9a3c;
const FLAME_GLOW_ALPHA = 0.7;
const FLAME_GLOW_RADIUS = { min: 16, max: 20 };
const SQUASH_WIDEN = 0.18;  // a full squash is 18% wider and 16% lower, pivoting on the feet
const SQUASH_FLATTEN = 0.16;

export const createFighterView = (): FighterView => {
    const root = new Container();
    const flameGlow = new Sprite(glowTexture()); flameGlow.label = 'fighterFlameGlow';
    flameGlow.anchor.set(0.5);
    flameGlow.blendMode = 'add';
    flameGlow.tint = FLAME_GLOW_TINT;
    flameGlow.visible = false;
    const body = new Graphics(); body.label = 'fighterBody';
    const head = new Graphics(); head.label = 'fighterHead';
    const weapon = new Sprite(); weapon.label = 'fighterWeapon';
    const front = new Graphics(); front.label = 'fighterFront';
    const light = createMuzzleLight();
    root.addChild(flameGlow, body, head, weapon, light, front);
    return { root, flameGlow, body, head, weapon, light, front, headKey: '' };
};

/** Place and size the glow at the middle of the flame; it follows the flicker. */
const placeFlameGlow = (glow: Sprite, pose: FighterPose, flicker: number) => {
    const base = upperPoint(pose, FLAME_BASE.x, FLAME_BASE.y);
    const len = flameLength(flicker);
    glow.position.set(base.x - pose.lean * len * 0.5, base.y + len * 0.5);
    glow.width = glow.height = 2 * (FLAME_GLOW_RADIUS.min + flicker * (FLAME_GLOW_RADIUS.max - FLAME_GLOW_RADIUS.min));
    glow.alpha = FLAME_GLOW_ALPHA;
};

export const drawFighter = (view: FighterView, f: FighterFrame) => {
    const { pose, grip } = f;
    const look = flashLook(f.look, f.hitFlash ?? 0);
    const squash = f.squash ?? 0;
    // The root's origin is at the feet, so scaling about it keeps them planted
    view.root.scale.set(f.facing * RIG_SCALE * (1 + SQUASH_WIDEN * squash), RIG_SCALE * (1 - SQUASH_FLATTEN * squash));

    view.flameGlow.visible = f.flame;
    if (f.flame) placeFlameGlow(view.flameGlow, pose, f.flicker);

    const b = view.body.clear();
    if (f.flame) drawFlame(b, pose, f.flicker);
    drawTail(b, pose, look, f.tailSwing);
    drawJetpack(b, pose, look, f.flame);
    const legDark = shade(look.leg, 0.72);
    jointedLimb(b, pose.hip, pose.backLeg.joint, pose.backLeg.end, { widths: [6.2 * LIMB_W, 5.4 * LIMB_W], colors: [legDark, legDark] });
    boot(b, pose.backLeg.end, 0x1b1f25);
    const armDark = shade(look.arm, 0.72);
    jointedLimb(b, pose.shoulderBack, pose.backArm.joint, pose.backArm.end, { widths: [4.6 * LIMB_W, 4.2 * LIMB_W], colors: [armDark, armDark] });
    drawTorso(b, pose, look);
    jointedLimb(b, pose.hip, pose.frontLeg.joint, pose.frontLeg.end, { widths: [6.4 * LIMB_W, 5.6 * LIMB_W], colors: [look.leg, shade(look.leg, 0.9)] });
    boot(b, pose.frontLeg.end, 0x252a32);

    const headKey = headKeyOf(look);
    if (view.headKey !== headKey) {
        drawHead(view.head.clear(), look);
        view.headKey = headKey;
    }
    view.head.position.set(pose.head.x, pose.head.y);
    view.head.rotation = pose.headTilt + (f.headBob ?? 0);

    const w = view.weapon;
    if (f.weapon && w.texture !== f.weapon) w.texture = f.weapon;
    w.visible = !!f.weapon;
    w.width = grip.length;
    w.height = grip.height;
    w.position.set(pose.gunTopLeft.x, pose.gunTopLeft.y);
    w.rotation = pose.gunAngle;

    const fr = view.front.clear();
    if (!f.weapon) drawFallbackGun(fr, f);
    if (f.muzzleFlash > 0) drawMuzzle(fr, view.light, muzzlePoint(pose, grip), pose.gunAngle, f.muzzleFlash, f.weaponType);
    else view.light.visible = false;
    hand(fr, pose.backArm.end);
    jointedLimb(fr, pose.shoulderFront, pose.frontArm.joint, pose.frontArm.end, { widths: [4.8 * LIMB_W, 4.4 * LIMB_W], colors: [look.arm, shade(look.arm, 0.92)] });
    hand(fr, pose.frontArm.end);
};

/** Plain gun shape when the weapon picture is missing. */
const drawFallbackGun = (g: Graphics, f: FighterFrame) => {
    const { pose, grip } = f;
    const c = Math.cos(pose.gunAngle), s = Math.sin(pose.gunAngle);
    const at = (x: number, y: number) => ({ x: pose.gunTopLeft.x + c * x - s * y, y: pose.gunTopLeft.y + s * x + c * y });
    const corners = [at(0, grip.axisY - 3), at(grip.length, grip.axisY - 3), at(grip.length, grip.axisY + 3), at(0, grip.axisY + 3)];
    g.poly(corners.flatMap(p => [p.x, p.y])).fill(FALLBACK_GUN);
};
