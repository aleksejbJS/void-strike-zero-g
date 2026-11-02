// A corpse on screen: a whole body drawn as the fighter in its lying pose, or the torn pieces,
// plus the dropped gun; fades out at the end of its life. One view per corpse in state.corpses.

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { WeaponType } from '../../../types';
import { Corpse } from '../../systems/ragdoll/corpseBody';
import { RIG_SCALE } from '../fighter/fighterPose';
import { createFighterView, drawFighter, FighterView } from '../fighter/fighterView';
import { heldWeaponKey } from '../fighter/fighterAnimator';
import { gripPoints } from '../fighter/weaponGrips';
import { IDLE_PARTS } from '../fighter/parts/partMotionFrame';
import { drawRagdollShape, lookOfCorpse } from '../ragdollView';
import { piecesOf, poseFromCorpse } from './corpsePose';

export interface CorpseView {
    root: Container;
    fighter?: FighterView; // a whole body (fall, thrown)
    pieces?: Graphics[];   // a torn body (gib, cut), in the order of piecesOf
    gun: Sprite;
}

type Textures = Record<string, Texture | undefined>;

/** Weapon picture height / width when the texture is not known (as in corpseBody.ts and the animator). */
const GUN_ASPECT = 0.23;

/** 1 while the corpse lies, then linear to 0 from fadeAt to removeAt. */
const alphaOf = (c: Corpse) => {
    if (c.age <= c.fadeAt) return 1;
    const fade = c.removeAt - c.fadeAt;
    return fade > 0 ? Math.max(0, 1 - (c.age - c.fadeAt) / fade) : 0;
};

/** The held-weapon picture stretched from gunA (its top-left corner) to gunB (one length along its top edge). */
const placeGun = (gun: Sprite, c: Corpse) => {
    if (!gun.visible) return;
    const { gunA: a, gunB: b } = c.points;
    const k = Math.hypot(b.x - a.x, b.y - a.y) / gun.texture.width;
    gun.position.set(a.x, a.y);
    gun.rotation = Math.atan2(b.y - a.y, b.x - a.x);
    // Mirrored with the body: for a corpse facing left the picture's bottom is on the other side of gunA → gunB
    gun.scale.set(k, c.facing * k);
};

const drawBody = (fighter: FighterView, c: Corpse) => {
    const { pose, origin } = poseFromCorpse(c);
    const weaponType = c.weapon ?? WeaponType.MACHINE_GUN;
    fighter.root.position.set(origin.x, origin.y);
    drawFighter(fighter, {
        pose, look: lookOfCorpse(c.colors), facing: c.facing, grip: gripPoints(weaponType, GUN_ASPECT),
        weaponless: true, flame: false, flicker: 0, parts: IDLE_PARTS, muzzleFlash: 0, weaponType,
    });
};

/** Move the view to the corpse's points and set its fade. */
export const updateCorpseView = (v: CorpseView, c: Corpse): void => {
    v.root.alpha = alphaOf(c);
    if (v.fighter) drawBody(v.fighter, c);
    if (v.pieces) {
        const pieces = v.pieces;
        piecesOf(c).forEach((p, i) => {
            pieces[i].position.set(p.at.x, p.at.y);
            pieces[i].rotation = p.rotation;
        });
    }
    placeGun(v.gun, c);
};

export const createCorpseView = (c: Corpse, textures: Textures): CorpseView => {
    const root = new Container(); root.label = 'corpse';
    const gun = new Sprite(); gun.label = 'corpseGun';
    const picture = c.weapon ? textures[heldWeaponKey(c.weapon)] : undefined;
    if (picture) gun.texture = picture;
    gun.visible = !!picture; // no picture yet (or no weapon): the corpse drops nothing
    root.addChild(gun); // the body lies over its gun
    let view: CorpseView;
    if (c.kind === 'gib' || c.kind === 'cut') {
        const pieces = piecesOf(c).map(p => {
            const g = new Graphics(); g.label = `corpse-${p.part}`;
            drawRagdollShape(g, p.part, c.colors);
            g.scale.set(c.facing * RIG_SCALE, RIG_SCALE);
            return g;
        });
        root.addChild(...pieces);
        view = { root, pieces, gun };
    } else {
        const fighter = createFighterView();
        root.addChild(fighter.root);
        view = { root, fighter, gun };
    }
    updateCorpseView(view, c);
    return view;
};

/** Destroy the view and everything drawn in it (Graphics contexts included, so nothing leaks). */
export const destroyCorpseView = (v: CorpseView): void => {
    if (!v.root.destroyed) v.root.destroy({ children: true, context: true });
};

/**
 * One view per corpse in `corpses`, kept in `cache.corpses` (created here on first use): new corpses get a
 * view at the back of `layer`, behind the living fighters; views of removed corpses are destroyed.
 */
export const syncCorpseViews = (layer: Container, corpses: Corpse[], cache: { corpses?: Map<string, CorpseView> }, textures: Textures): void => {
    const views = (cache.corpses ??= new Map());
    const lying = new Set(corpses.map(c => c.id));
    for (const [id, v] of views) {
        if (lying.has(id)) continue;
        destroyCorpseView(v);
        views.delete(id);
    }
    for (const c of corpses) {
        const v = views.get(c.id);
        if (v) { updateCorpseView(v, c); continue; }
        const created = createCorpseView(c, textures);
        layer.addChildAt(created.root, 0);
        views.set(c.id, created);
    }
};
