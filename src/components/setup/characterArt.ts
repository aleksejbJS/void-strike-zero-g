// Character-setup preview: the same fighter as in game, standing idle with a machine gun.
// Feet stand on y = 0 of the returned container.

import { Container, Texture } from 'pixi.js';
import { WeaponType } from '../../types';
import { FighterBuild } from '../../game/build/buildParts';
import { createFighterView, drawFighter } from '../../game/render/fighter/fighterView';
import { solvePose } from '../../game/render/fighter/fighterPose';
import { lookFromSetup } from '../../game/render/fighter/fighterLook';
import { gripPoints } from '../../game/render/fighter/weaponGrips';
import { heldWeaponKey } from '../../game/render/fighter/fighterAnimator';
import { IDLE_PARTS } from '../../game/render/fighter/parts/partMotionFrame';

export interface CharacterLook {
    build: FighterBuild;
    torso: string;
    head: string;
    arms: string;
    legs: string;
    jetpack: string;
}

const PREVIEW_AIM = -0.12; // slightly raised, ready to fire

export interface CharacterArt {
    root: Container;
    /** Redraw for time `t` in seconds (breathing). */
    update: (t: number) => void;
}

export const buildCharacter = (look: CharacterLook, textures: Record<string, Texture>): CharacterArt => {
    const view = createFighterView();
    const fighterLook = lookFromSetup(look, look.build);
    const weapon = textures[heldWeaponKey(WeaponType.MACHINE_GUN)];
    const grip = gripPoints(WeaponType.MACHINE_GUN, weapon ? weapon.height / weapon.width : 0.23);

    const update = (t: number) => drawFighter(view, {
        pose: solvePose({ state: 'idle', aim: PREVIEW_AIM, t, phase: 0, moveDir: 1, recoil: 0, grip, body: look.build.body }),
        look: fighterLook, facing: 1, grip, weapon, weaponType: WeaponType.MACHINE_GUN,
        flame: false, flicker: 0, parts: { ...IDLE_PARTS, tailWave: t }, muzzleFlash: 0,
    });
    update(0);
    return { root: view.root, update };
};
