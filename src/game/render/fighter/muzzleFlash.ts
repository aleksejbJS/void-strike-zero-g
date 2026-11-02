// Muzzle flash: a 4-point star with a white core on the front layer and a warm light sprite on the body.
// The flash is brightest on the shot and fades out (strength comes from muzzleEnvelope). Everything is in rig units.

import { Graphics, Sprite } from 'pixi.js';
import { Vector2, WeaponType } from '../../../types';
import { glowTexture } from '../effects/glowTextures';
import { FighterPose, RIG_SCALE } from './fighterPose';
import { GripPoints } from './weaponGrips';
import { isBigFlash } from './muzzleEnvelope';

const STAR_COLOR = 0xffecaa;
const CORE_COLOR = 0xffffff;
const LIGHT_TINT = 0xffc85a;
const STAR_LENGTH = 7;      // tip distance from the centre
const STAR_INNER = 2.2;     // radius of the notches between the tips
const CORE_LENGTH = 4;      // half-length of the white core along the barrel
const CORE_WIDTH = 1.6;     // half-width of the core
const CORE_AHEAD = 1.5;     // the core sits slightly ahead of the muzzle
const CORE_SEGMENTS = 14;
const LIGHT_RADIUS = 22;    // screen pixels: the light does not grow with the rig scale
const LIGHT_ALPHA = 0.5;
const BIG_FLASH = 1.6;      // heavy weapons: longer star and core
const BIG_LIGHT = 1.5;      // ...and a wider light (33 px at most)
const LIGHT_BACK = 10;      // the light is centred this far behind the muzzle, so it also lights the hands and forearm
const BARREL_GAP = 2;       // the flash starts just past the end of the weapon picture

/** Where the barrel ends, in rig units. */
export const muzzlePoint = (pose: FighterPose, grip: GripPoints): Vector2 => {
    const len = grip.length + BARREL_GAP;
    const c = Math.cos(pose.gunAngle), s = Math.sin(pose.gunAngle);
    return {
        x: pose.gunTopLeft.x + c * len - s * grip.axisY,
        y: pose.gunTopLeft.y + s * len + c * grip.axisY,
    };
};

/** The light sprite the fighter view keeps between the body and the front arm. */
export const createMuzzleLight = (): Sprite => {
    const light = new Sprite(glowTexture()); light.label = 'fighterMuzzleLight';
    light.anchor.set(0.5);
    light.blendMode = 'add';
    light.tint = LIGHT_TINT;
    light.visible = false;
    return light;
};

/** Star with a tip pointing along `angle`; notches sit halfway between the tips. */
const starPoints = (at: Vector2, angle: number, length: number, inner: number): number[] => {
    const points: number[] = [];
    for (let i = 0; i < 8; i++) {
        const r = i % 2 === 0 ? length : inner;
        const a = angle + (i * Math.PI) / 4;
        points.push(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r);
    }
    return points;
};

/** Ellipse turned to `angle` (a Graphics ellipse is always axis-aligned). */
const ellipsePoints = (at: Vector2, angle: number, rx: number, ry: number): number[] => {
    const c = Math.cos(angle), s = Math.sin(angle);
    const points: number[] = [];
    for (let i = 0; i < CORE_SEGMENTS; i++) {
        const t = (i / CORE_SEGMENTS) * Math.PI * 2;
        const x = Math.cos(t) * rx, y = Math.sin(t) * ry;
        points.push(at.x + c * x - s * y, at.y + s * x + c * y);
    }
    return points;
};

/** Draw the flash at strength k (0..1); k = 0 draws nothing and hides the light. */
export const drawMuzzle = (front: Graphics, light: Sprite, muzzle: Vector2, angle: number, k: number, weapon: WeaponType) => {
    light.visible = k > 0;
    if (k <= 0) return;
    const big = isBigFlash(weapon);
    const size = k * (big ? BIG_FLASH : 1);

    front.poly(starPoints(muzzle, angle, STAR_LENGTH * size, STAR_INNER * k)).fill({ color: STAR_COLOR, alpha: k });
    const core = { x: muzzle.x + Math.cos(angle) * CORE_AHEAD, y: muzzle.y + Math.sin(angle) * CORE_AHEAD };
    front.poly(ellipsePoints(core, angle, CORE_LENGTH * size, CORE_WIDTH * k)).fill({ color: CORE_COLOR, alpha: k });

    light.position.set(muzzle.x - Math.cos(angle) * LIGHT_BACK, muzzle.y - Math.sin(angle) * LIGHT_BACK);
    light.width = light.height = (2 * LIGHT_RADIUS * (big ? BIG_LIGHT : 1)) / RIG_SCALE;
    light.alpha = LIGHT_ALPHA * k;
};
