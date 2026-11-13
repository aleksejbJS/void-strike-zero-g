// Small helpers shared by the flame's sprite views: make a sprite on a flame texture, and copy a plain
// draw record (world px sizes) onto it.

import { Container, Sprite, Texture } from 'pixi.js';

export interface DrawLike { x: number; y: number; angle: number; w: number; h: number; tint: number; alpha: number }

/** A sprite in `layer` on `tex`; `anchorY` 1 stands it on its base (tongues, flame masses). */
export const flameSprite = (layer: Container, tex: Texture, additive: boolean, anchorY = 0.5): Sprite => {
    const s = new Sprite(tex);
    s.anchor.set(0.5, anchorY);
    if (additive) s.blendMode = 'add';
    s.visible = false;
    layer.addChild(s);
    return s;
};

/** Show `s` as `d` describes, or hide it when `visible` is false. */
export const applyDraw = (s: Sprite, d: DrawLike, visible: boolean): void => {
    s.visible = visible;
    if (!visible) return;
    s.position.set(d.x, d.y);
    s.rotation = d.angle;
    s.scale.set(d.w / s.texture.width, d.h / s.texture.height);
    s.tint = d.tint;
    s.alpha = Math.min(1, d.alpha);
};

/** Destroy a layer and its sprites; the shared flame textures stay. */
export const destroyLayer = (layer: Container): void => {
    layer.destroy({ children: true });
};
