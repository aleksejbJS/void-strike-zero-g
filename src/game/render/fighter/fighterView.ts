// A fighter on screen: Pixi layers (body, head, weapon, front arm) redrawn from a pose each frame.

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { FighterPose, RIG_SCALE } from './fighterPose';
import { FighterLook, shade } from './fighterLook';
import { boot, drawFlame, drawHead, drawJetpack, drawTail, drawTorso, hand, limb } from './fighterParts';
import { GripPoints } from './weaponGrips';

export interface FighterView {
    root: Container;
    body: Graphics;    // jetpack, legs, back arm, torso
    head: Graphics;
    weapon: Sprite;
    front: Graphics;   // hands and the front arm, over the weapon
    headKey: string;   // look the head was drawn for
}

export interface FighterFrame {
    pose: FighterPose;
    look: FighterLook;
    facing: number;    // 1 right, -1 left
    grip: GripPoints;
    weapon?: Texture;
    flame: boolean;
    flicker: number;   // 0..1, flame length jitter
    tailSwing: number; // -1..1
    muzzleFlash: number; // 0..1
}

export const createFighterView = (): FighterView => {
    const root = new Container();
    const body = new Graphics(); body.label = 'fighterBody';
    const head = new Graphics(); head.label = 'fighterHead';
    const weapon = new Sprite(); weapon.label = 'fighterWeapon';
    const front = new Graphics(); front.label = 'fighterFront';
    root.addChild(body, head, weapon, front);
    return { root, body, head, weapon, front, headKey: '' };
};

const FALLBACK_GUN = 0x1e293b;

export const drawFighter = (view: FighterView, f: FighterFrame) => {
    const { pose, look, grip } = f;
    view.root.scale.set(f.facing * RIG_SCALE, RIG_SCALE);

    const b = view.body.clear();
    if (f.flame) drawFlame(b, pose, f.flicker);
    drawTail(b, pose, look, f.tailSwing);
    drawJetpack(b, pose, look);
    const legDark = shade(look.leg, 0.72);
    limb(b, pose.hip, pose.backLeg.joint, 6.2, legDark);
    limb(b, pose.backLeg.joint, pose.backLeg.end, 5.4, legDark);
    boot(b, pose.backLeg.end, 0x1b1f25);
    const armDark = shade(look.arm, 0.72);
    limb(b, pose.shoulderBack, pose.backArm.joint, 4.6, armDark);
    limb(b, pose.backArm.joint, pose.backArm.end, 4.2, armDark);
    drawTorso(b, pose, look);
    limb(b, pose.hip, pose.frontLeg.joint, 6.4, look.leg);
    limb(b, pose.frontLeg.joint, pose.frontLeg.end, 5.6, shade(look.leg, 0.9));
    boot(b, pose.frontLeg.end, 0x252a32);

    const headKey = `${look.style}:${look.head}:${look.accent}`;
    if (view.headKey !== headKey) {
        drawHead(view.head.clear(), look);
        view.headKey = headKey;
    }
    view.head.position.set(pose.head.x, pose.head.y);
    view.head.rotation = pose.headTilt;

    const w = view.weapon;
    if (f.weapon && w.texture !== f.weapon) w.texture = f.weapon;
    w.visible = !!f.weapon;
    w.width = grip.length;
    w.height = grip.height;
    w.position.set(pose.gunTopLeft.x, pose.gunTopLeft.y);
    w.rotation = pose.gunAngle;

    const fr = view.front.clear();
    if (!f.weapon) drawFallbackGun(fr, f);
    if (f.muzzleFlash > 0.55) {
        const len = grip.length + 2;
        const c = Math.cos(pose.gunAngle), s = Math.sin(pose.gunAngle);
        const mx = pose.gunTopLeft.x + c * len - s * grip.axisY;
        const my = pose.gunTopLeft.y + s * len + c * grip.axisY;
        fr.circle(mx, my, 3.5 * f.muzzleFlash).fill({ color: 0xffd65a, alpha: 0.95 });
    }
    hand(fr, pose.backArm.end);
    limb(fr, pose.shoulderFront, pose.frontArm.joint, 4.8, look.arm);
    limb(fr, pose.frontArm.joint, pose.frontArm.end, 4.4, shade(look.arm, 0.92));
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
