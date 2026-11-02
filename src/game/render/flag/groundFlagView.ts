// A FLAG pickup on the map: on its plinth at a CTF base, upright on the Hold the Flag
// pedestal, planted at a lean with a pulsing ring when dropped, or bobbing in mid-air.

import { Container, Graphics, Sprite } from 'pixi.js';
import { Pickup, Platform } from '../../../types';
import { FlagPose, FlagRig } from './flagRig';
import { FlagPalette, flagPaletteFor } from './flagPalette';
import { GroundFlagKind, placeGroundFlag } from './flagPlacement';
import { drawDropRing, drawPlinth, drawPlinthLight, makeFloorGlow, PLINTH_HEIGHT } from './flagStand';

interface GroundFlagParts {
    pal: FlagPalette;
    rig: FlagRig;
    floorGlow: Sprite;
    plinth: Graphics;
    light: Graphics;
    ring: Graphics;
}

const parts = new WeakMap<Container, GroundFlagParts>();

const BOB = 4;

const poseFor = (kind: GroundFlagKind, t: number): FlagPose => {
    const breeze = { angle: 0.2 + 0.06 * Math.sin(t * 0.7), ampMul: 1, omegaMul: 1 };
    switch (kind) {
        case 'base': return { poleLen: 136, lean: 0, clothScale: 1, wind: breeze };
        case 'spot': return { poleLen: 120, lean: 0, clothScale: 0.9, wind: breeze };
        case 'dropped': return { poleLen: 104, lean: -0.38, clothScale: 0.8, wind: { angle: 0.75 + 0.05 * Math.sin(t), ampMul: 0.55, omegaMul: 0.8 } };
        case 'midair': return { poleLen: 104, lean: 0, clothScale: 0.8, wind: { angle: 0.5, ampMul: 0.8, omegaMul: 1 } };
    }
};

export const createGroundFlagVisual = (item: Pickup): Container => {
    const c = new Container();
    c.label = item.id;
    const pal = flagPaletteFor(item.team);
    const floorGlow = makeFloorGlow(pal);
    const ring = new Graphics();
    drawDropRing(ring, pal);
    const plinth = new Graphics();
    drawPlinth(plinth);
    const light = new Graphics();
    drawPlinthLight(light, pal);
    const rig = new FlagRig();
    c.addChild(floorGlow, ring, plinth, light, rig.root);
    parts.set(c, { pal, rig, floorGlow, plinth, light, ring });
    return c;
};

export const updateGroundFlagVisual = (c: Container, item: Pickup, platforms: Platform[], now: number) => {
    const p = parts.get(c);
    c.visible = item.active && !!p;
    if (!c.visible || !p) return;

    // Each flag waves out of step with the others
    const t = now / 1000 + (Math.abs(item.pos.x) % 97) / 31;
    const place = placeGroundFlag(item, platforms);
    const onPlinth = place.kind === 'base';
    const bob = place.kind === 'midair' ? Math.sin(t * 3) * BOB : 0;
    c.position.set(place.foot.x, place.foot.y + bob);
    c.scale.x = place.kind === 'dropped' ? place.side : 1;

    const pulse = Math.sin(t * 3);
    p.floorGlow.visible = p.plinth.visible = p.light.visible = onPlinth;
    p.floorGlow.alpha = 0.4 * (1 + 0.2 * pulse);
    p.light.alpha = 0.75 + 0.25 * pulse;
    p.ring.visible = place.kind === 'dropped';
    p.ring.alpha = 0.45 + 0.35 * Math.sin(t * 4);

    p.rig.root.y = onPlinth ? -PLINTH_HEIGHT : 0;
    p.rig.draw(p.pal, poseFor(place.kind, t), t);
};
