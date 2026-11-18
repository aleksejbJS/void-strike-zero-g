// A corpse on screen: a whole body drawn as the fighter in its lying pose, or the torn pieces,
// plus the dropped gun; fades out at the end of its life. One view per corpse in state.corpses.

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { WeaponType } from '../../../types';
import { Corpse } from '../../systems/ragdoll/corpseBody';
import { FighterLook } from '../fighter/fighterLook';
import { RIG_SCALE } from '../fighter/fighterPose';
import { HEAD_R } from '../fighter/fighterStyle';
import { createFighterView, drawFighter, FighterView } from '../fighter/fighterView';
import { heldWeaponKey } from '../fighter/fighterAnimator';
import { gripPoints } from '../fighter/weaponGrips';
import { IDLE_PARTS } from '../fighter/parts/partMotionFrame';
import { drawRagdollShape, lookOfCorpse } from '../ragdollView';
import { cutLegsOf, piecesOf, poseFromCorpse } from './corpsePose';
import { drawLegsHalf } from './cutHalves';
import { CorpseArt, createCorpseArt, updateCorpseArt } from '../characters/corpseArt';

export interface CorpseView {
    root: Container;
    fighter?: FighterView; // a whole body (fall, thrown)
    illustrated?: CorpseArt; // torn pieces sampling the same source picture as the living fighter
    pieces?: Graphics[];   // a torn body (gib, cut), in the order of piecesOf
    gun: Sprite;
    head?: HeadRoll;       // a torn-off head (gib): it turns on its own, not with the neck it left
    legsLook?: FighterLook; // cut legs: redrawn when they move, bending at the knees with their points
    drawnAt?: number[];     // the points (x, y, x, y...) the body or cut legs were last drawn at
    drawnContacts?: number; // a changed support state must redraw even when its points lie still
}

/** How far a torn-off head has turned, and where its point was when the turn was last updated. */
export interface HeadRoll { turn: number; x: number }

type Textures = Record<string, Texture | undefined>;

/** Weapon picture height / width when the texture is not known (as in corpseBody.ts and the animator). */
const GUN_ASPECT = 0.23;
/** A torn-off head rolls like a ball of the head's size: one radian per this many world units moved sideways. */
const HEAD_ROLL_RADIUS = HEAD_R * RIG_SCALE;

/** A body whose every point is within this (world units) of where it was last drawn is not drawn again. */
const STILL = 0.05;

/** True when a point moved since the last draw (then the new positions are remembered as drawn). */
const movedSinceDrawn = (v: CorpseView, c: Corpse): boolean => {
    const points = Object.values(c.points);
    const contacts = points.reduce((mask, point, i) => mask | (point.supported ? 1 << i : 0), 0);
    const last = v.drawnAt;
    if (last && v.drawnContacts === contacts && points.every((p, i) => Math.abs(p.x - last[2 * i]) < STILL && Math.abs(p.y - last[2 * i + 1]) < STILL)) return false;
    v.drawnAt = points.flatMap(p => [p.x, p.y]);
    v.drawnContacts = contacts;
    return true;
};

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
        weaponless: true, flame: false, flicker: 0, parts: IDLE_PARTS, muzzleFlash: 0, weaponType, oneLeg: c.oneLeg,
        tankLit: c.tankId !== undefined,
    });
};

/**
 * The torn-off head is a lone point with no neck to turn it: it rolls with its sideways travel
 * (moving right turns it clockwise) and stops turning when the point stops.
 */
const rollHead = (head: HeadRoll, c: Corpse) => {
    const x = c.points.head.x;
    head.turn += (x - head.x) / HEAD_ROLL_RADIUS;
    head.x = x;
    return head.turn;
};

/** Move the view to the corpse's points and set its fade; a body lying still is not redrawn. */
export const updateCorpseView = (v: CorpseView, c: Corpse): void => {
    v.root.alpha = alphaOf(c);
    const redraw = movedSinceDrawn(v, c);
    if (v.fighter && redraw) drawBody(v.fighter, c);
    if (v.illustrated && redraw) updateCorpseArt(v.illustrated, c, v.head ? rollHead(v.head, c) : undefined);
    if (v.pieces) {
        const pieces = v.pieces;
        piecesOf(c).forEach((p, i) => {
            pieces[i].position.set(p.at.x, p.at.y);
            pieces[i].rotation = p.part === 'head' && v.head ? rollHead(v.head, c) : p.rotation;
            if (p.part === 'legs' && v.legsLook && redraw) drawLegsHalf(pieces[i].clear(), v.legsLook, cutLegsOf(c), c.oneLeg);
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
        const illustrated = createCorpseArt(c);
        const headPiece = c.kind === 'gib' ? piecesOf(c).find(p => p.part === 'head') : undefined;
        const head = headPiece && { turn: headPiece.rotation, x: c.points.head.x };
        if (illustrated) {
            root.addChild(illustrated.root);
            view = { root, illustrated, gun, head };
        } else {
            const pieces = piecesOf(c).map(p => {
                const g = new Graphics(); g.label = `corpse-${p.part}`;
                drawRagdollShape(g, p.part, c.colors);
                g.scale.set(c.facing * RIG_SCALE, RIG_SCALE);
                return g;
            });
            root.addChild(...pieces);
            // A gib head starts at its tilt at death and rolls on from there
            view = { root, pieces, gun, head };
            if (c.kind === 'cut') view.legsLook = lookOfCorpse(c.colors);
        }
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
