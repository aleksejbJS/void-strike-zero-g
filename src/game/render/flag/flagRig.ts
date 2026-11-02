// One flag on screen: pole (built once per colour and length), cloth (redrawn every
// frame) and the crystal's glow. The root's origin is the pole's foot.

import { Container, Graphics, Sprite } from 'pixi.js';
import { Vector2 } from '../../../types';
import { glowTexture } from '../effects/glowTextures';
import { clothShape, ClothWind, STANDARD_CLOTH } from './flagCloth';
import { CRYSTAL_HEIGHT, drawCloth, drawPole } from './flagPaint';
import { FlagPalette } from './flagPalette';

export interface FlagPose {
    poleLen: number;
    lean: number;       // pole tilt, rad; positive tips the top toward +x
    clothScale: number;
    wind: ClothWind;
}

const CRYSTAL_GLOW_RADIUS = 14;
const CLOTH_PIN_BELOW_TOP = 4;

const along = (lean: number, dist: number, side = 0): Vector2 => ({
    x: Math.sin(lean) * dist + Math.cos(lean) * side,
    y: -Math.cos(lean) * dist + Math.sin(lean) * side,
});

export class FlagRig {
    readonly root = new Container();
    private readonly pole = new Graphics();
    private readonly cloth = new Graphics();
    private readonly glow = new Sprite(glowTexture());
    private builtFor: FlagPalette | null = null;
    private builtLen = 0;
    private crystal: Vector2 = { x: 0, y: 0 };

    constructor() {
        this.glow.anchor.set(0.5);
        this.glow.blendMode = 'add';
        this.glow.width = this.glow.height = CRYSTAL_GLOW_RADIUS * 2;
        this.root.addChild(this.pole, this.cloth, this.glow);
    }

    draw(pal: FlagPalette, pose: FlagPose, t: number) {
        if (pal !== this.builtFor || pose.poleLen !== this.builtLen) {
            this.pole.clear();
            drawPole(this.pole, pose.poleLen, pal);
            this.glow.tint = pal.main;
            this.builtFor = pal;
            this.builtLen = pose.poleLen;
        }
        this.pole.rotation = pose.lean;

        const pin = along(pose.lean, pose.poleLen - CLOTH_PIN_BELOW_TOP, 2);
        this.cloth.position.set(pin.x, pin.y);
        this.cloth.scale.set(pose.clothScale);
        this.cloth.clear();
        drawCloth(this.cloth, clothShape(STANDARD_CLOTH, pose.wind, t), STANDARD_CLOTH, pal);

        this.crystal = along(pose.lean, pose.poleLen + CRYSTAL_HEIGHT / 2);
        this.glow.position.set(this.crystal.x, this.crystal.y);
        this.glow.alpha = 0.7 + 0.15 * Math.sin(t * 3);
    }

    /** Centre of the crystal in the root's frame, as of the last draw. */
    crystalPoint(): Vector2 {
        return this.crystal;
    }

    destroy() {
        this.root.destroy({ children: true, context: true });
    }
}
