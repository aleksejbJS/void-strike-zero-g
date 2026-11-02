// Flag (or intel) carried on the fighter's back, with a halo; Hold the Flag carriers also burn.

import { Container, Graphics, Sprite } from 'pixi.js';
import { Entity, GameMode, Team, Vector2 } from '../../types';
import { glowTexture } from './effects/glowTextures';
import { carriedWind } from './flag/carriedWind';
import { carriedPaletteFor } from './flag/flagPalette';
import { FlagRig } from './flag/flagRig';

const POLE_LEN = 60;
const CLOTH_SCALE = 0.5;
const HALO_RADIUS = 36;
const HALO_HEIGHT = 40; // centre of the halo above the feet

interface CarriedParts {
    holder: Container;
    halo: Sprite;
    rig: FlagRig;
    fire: Graphics;
}

const carried = new WeakMap<Container, CarriedParts>();

const remove = (c: Container) => {
    const parts = carried.get(c);
    if (!parts) return;
    c.removeChild(parts.holder);
    parts.holder.destroy({ children: true, context: true });
    carried.delete(c);
};

const ensure = (c: Container): CarriedParts => {
    const existing = carried.get(c);
    if (existing) return existing;
    const holder = new Container();
    holder.label = 'carriedFlag';
    const halo = new Sprite(glowTexture());
    halo.anchor.set(0.5);
    halo.blendMode = 'add';
    halo.width = halo.height = HALO_RADIUS * 2;
    halo.position.set(0, -HALO_HEIGHT);
    const rig = new FlagRig();
    const fire = new Graphics();
    holder.addChild(halo, rig.root, fire);
    c.addChildAt(holder, 0); // behind the fighter
    const parts = { holder, halo, rig, fire };
    carried.set(c, parts);
    return parts;
};

const drawFire = (g: Graphics, x: number, y: number) => {
    for (let i = 0; i < 6; i++) {
        g.circle(x + (Math.random() - 0.5) * 14, y - Math.random() * 10, 2.5 + Math.random() * 2)
            .fill({ color: 0xfbbf24, alpha: 0.9 });
    }
};

/** `back` is the pole's foot relative to the player's feet, in world pixels. */
export const drawCarriedFlag = (c: Container, p: Entity, facing: number, back: Vector2, now: number, mode: GameMode) => {
    if (p.hasFlag === Team.NONE) {
        remove(c);
        return;
    }
    const { halo, rig, fire } = ensure(c);
    const t = now / 1000;
    const pal = carriedPaletteFor(p, mode);

    halo.tint = pal.main;
    halo.alpha = 0.25 * (1 + 0.1 * Math.sin(t * 6));

    const wind = carriedWind(p.vel, facing);
    rig.root.position.set(back.x, back.y);
    rig.root.scale.x = wind.side;
    rig.draw(pal, { poleLen: POLE_LEN, lean: wind.lean, clothScale: CLOTH_SCALE, wind }, t);

    fire.clear();
    if (mode !== GameMode.HOLD_THE_FLAG) return;
    const crystal = rig.crystalPoint();
    drawFire(fire, back.x + crystal.x * wind.side, back.y + crystal.y);
};
