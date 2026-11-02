// The picture on one part tile: the head alone for head slots, otherwise the idle fighter zoomed onto the
// part (lit flame for flames, open wings for jetpacks, no front arm over patterns). Returned at the origin, filling 0..THUMB_SIZE.

import { Container, Graphics, Texture } from 'pixi.js';
import { WeaponType } from '../../../types';
import { FighterBuild, Slot } from '../../../game/build/buildParts';
import { createFighterView, drawFighter } from '../../../game/render/fighter/fighterView';
import { solvePose } from '../../../game/render/fighter/fighterPose';
import { FighterLook, SetupColors, lookFromSetup } from '../../../game/render/fighter/fighterLook';
import { gripPoints } from '../../../game/render/fighter/weaponGrips';
import { drawHead } from '../../../game/render/fighter/parts/helmets';
import { drawEars } from '../../../game/render/fighter/parts/ears';
import { IDLE_PARTS, PartMotionFrame } from '../../../game/render/fighter/parts/partMotionFrame';
import { isHeadSlot } from './partThumbnails';

export const THUMB_SIZE = 96;

/** Square window onto the drawing: its centre and side, in the units the part is drawn in. */
interface Frame { cx: number; cy: number; side: number }

// Head slots: head space around the head's origin. Others: fighter space, feet at (0, 0), facing right.
const HEAD_FRAME: Frame = { cx: 0, cy: -7, side: 34 };
const BODY_FRAMES: Partial<Record<Slot, Frame>> = {
    tail: { cx: -13, cy: -32, side: 52 },
    pattern: { cx: 7, cy: -44, side: 46 },
    badge: { cx: 12, cy: -46, side: 46 },
    jetpack: { cx: -4, cy: -46, side: 62 },
    flame: { cx: -7, cy: -32, side: 48 },
};
const WHOLE_FIGHTER: Frame = { cx: 0, cy: -40, side: 84 };
const AIM = 0.5;            // gun lowered, so it hides less of the torso
const FLAME_FLICKER = 0.6;

/** Fit `frame` into the thumbnail square. */
const place = (art: Container, frame: Frame) => {
    const k = THUMB_SIZE / frame.side;
    art.scale.set(k);
    art.position.set(THUMB_SIZE / 2 - frame.cx * k, THUMB_SIZE / 2 - frame.cy * k);
};

const headArt = (look: FighterLook): Container => {
    const art = new Container();
    const ears = new Graphics();
    const head = new Graphics();
    drawEars(ears, look, { ...IDLE_PARTS, lampOn: true });
    drawHead(head, look);
    art.addChild(ears, head);
    return art;
};

const fighterArt = (slot: Slot, look: FighterLook, weapon: Texture | undefined): Container => {
    const view = createFighterView();
    const grip = gripPoints(WeaponType.MACHINE_GUN, weapon ? weapon.height / weapon.width : 0.23);
    const parts: PartMotionFrame = { ...IDLE_PARTS, wingsOpen: slot === 'jetpack' ? 1 : 0 };
    drawFighter(view, {
        pose: solvePose({ state: 'idle', aim: AIM, t: 0, phase: 0, moveDir: 1, recoil: 0, grip }),
        look, facing: 1, grip, weapon, weaponType: WeaponType.MACHINE_GUN,
        flame: slot === 'flame', flicker: FLAME_FLICKER, parts, muzzleFlash: 0,
    });
    // The front arm and gun cross the chest; without them the whole torso pattern shows
    if (slot === 'pattern') view.front.visible = view.weapon.visible = view.light.visible = false;
    const art = new Container();
    art.addChild(view.root);
    return art;
};

/** A container to extract with the frame (0, 0, THUMB_SIZE, THUMB_SIZE). Destroy it with `{ children: true, context: true }`. */
export const thumbnailArt = (slot: Slot, build: FighterBuild, colors: SetupColors, weapon: Texture | undefined): Container => {
    const look = lookFromSetup(colors, build);
    const art = isHeadSlot(slot) ? headArt(look) : fighterArt(slot, look, weapon);
    place(art, isHeadSlot(slot) ? HEAD_FRAME : BODY_FRAMES[slot] ?? WHOLE_FIGHTER);
    const holder = new Container(); // stays at identity: extract renders its children only
    holder.addChild(art);
    return holder;
};
