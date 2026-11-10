// Illustrated gib pieces share the living fighter's meshes and never own source textures.
import { Container, Graphics } from 'pixi.js';
import { isBodyId } from '../../build/bodyTypes';
import type { Corpse } from '../../systems/ragdoll/corpseBody';
import { RIG_SCALE } from '../fighter/fighterPose';
import { TORSO_W } from '../fighter/fighterStyle';
import { drawHead } from '../fighter/parts/helmets';
import { drawEars } from '../fighter/parts/ears';
import { IDLE_PARTS } from '../fighter/parts/partMotionFrame';
import { lookOfCorpse } from '../ragdollView';
import { BODY_ART } from './definitions';
import { RUNTIME_BODY_ART } from './runtimeDefinitions';
import { corpseRigTargets } from './corpseTargets';
import { ArtRig, createArtRig, updateArtRig } from './rigView';
import { bodyAtlasTexture, bodyPictureTexture, bodyTexture } from './textures';
import { drawPattern } from '../fighter/parts/patterns';
import { drawBadge } from '../fighter/parts/badges';
import { drawTail } from '../fighter/parts/tails';
import { drawJetpack } from '../fighter/parts/jetpacks';
import { poseFromCorpse } from '../ragdoll/corpsePose';
import type { ArtTarget } from './placement';
import { selectHumanArt } from './humanArtSelector';
import { createHumanWounds, humanCorpseWoundTargets, updateHumanWounds, type HumanWounds } from './humanWounds';

export interface CorpseArt {
    root: Container; rig: ArtRig;
    upperPaint: Graphics; lowerPaint: Graphics; badge: Graphics; tail: Graphics; jetpack: Graphics;
    upperMask?: Graphics; lowerMask?: Graphics;
    wounds?: HumanWounds;
}

const bodyFrame = (layer: Container, target?: ArtTarget): void => {
    layer.visible = !!target;
    if (!target) return;
    layer.position.set(target.start.x, target.start.y);
    const end = target.end;
    layer.rotation = end ? Math.atan2(end.y - target.start.y, end.x - target.start.x) + Math.PI / 2 : target.rotation ?? 0;
    layer.scale.y = end ? Math.hypot(end.x - target.start.x, end.y - target.start.y) / 19 : 1;
};

export const createCorpseArt = (c: Corpse): CorpseArt | undefined => {
    const id = c.colors?.build?.body;
    const texture = isBodyId(id) ? bodyTexture(id) : undefined;
    if (!texture || !isBodyId(id)) return undefined;
    try {
        const atlas = bodyAtlasTexture(id);
        const base = atlas && RUNTIME_BODY_ART[id].atlas ? RUNTIME_BODY_ART[id] : BODY_ART[id];
        const definition = selectHumanArt(base, undefined, 'dead');
        const rig = createArtRig(definition, texture, atlas, bodyPictureTexture), root = new Container();
        const art: CorpseArt = { root, rig, upperPaint: new Graphics(), lowerPaint: new Graphics(),
            badge: new Graphics(), tail: new Graphics(), jetpack: new Graphics() };
        root.label = 'corpse-art';
        art.jetpack.label = 'corpse-jetpack';
        // rig.under (3D-kit palms) stays hidden on corpses but must be parented so the view destroys it
        root.addChild(rig.tail, art.tail, art.jetpack, rig.back, rig.body, art.upperPaint, art.lowerPaint, art.badge, rig.head, rig.under, rig.front, rig.overlay);
        art.wounds = createHumanWounds(definition, bodyPictureTexture);
        if (art.wounds) root.addChild(art.wounds.root);
        if (c.kind === 'cut') {
            // Paint crossing the waist is clipped into the two independent body frames.
            art.upperMask = new Graphics().rect(-100, -100, 200, 90.5).fill(0xffffff);
            art.lowerMask = new Graphics().rect(-100, -9.5, 200, 110).fill(0xffffff);
            root.addChild(art.upperMask, art.lowerMask);
            art.upperPaint.mask = art.upperMask; art.lowerPaint.mask = art.lowerMask;
        }
        return art;
    } catch (error) {
        console.error(`Corpse artwork "${id}" could not be created; using the existing corpse drawing:`, error);
        return undefined;
    }
};

export const updateCorpseArt = (art: CorpseArt, c: Corpse, headTurn?: number): void => {
    const targets = corpseRigTargets(art.rig.definition, c, headTurn), look = lookOfCorpse(c.colors);
    art.root.position.set(c.points.hip.x, c.points.hip.y);
    art.root.scale.set(c.facing * RIG_SCALE, RIG_SCALE);
    updateArtRig(art.rig, targets, look, look.build.helmet !== 'none', look.build.tail !== 'none');
    if (art.wounds) updateHumanWounds(art.wounds, humanCorpseWoundTargets(art.rig.definition, c, targets));
    bodyFrame(art.upperPaint, targets.torso);
    bodyFrame(art.lowerPaint, c.kind === 'cut' ? targets.pelvis : undefined);
    bodyFrame(art.badge, targets.torso);
    if (art.upperMask) bodyFrame(art.upperMask, targets.torso);
    if (art.lowerMask) bodyFrame(art.lowerMask, targets.pelvis);
    drawPattern(art.upperPaint.clear(), (x, y) => ({ x: x * TORSO_W, y }), look);
    drawPattern(art.lowerPaint.clear(), (x, y) => ({ x: x * TORSO_W, y }), look);
    drawBadge(art.badge.clear(), (x, y) => ({ x, y }), look, c.facing < 0);
    bodyFrame(art.tail, targets.tail);
    art.tail.visible &&= look.build.tail !== 'none';
    const { pose } = poseFromCorpse(c);
    const localPose = { ...pose, hip: { x: 0, y: 0 }, lean: 0, lift: 0 };
    drawTail(art.tail.clear(), localPose, look, IDLE_PARTS);
    bodyFrame(art.jetpack, targets.torso);
    drawJetpack(art.jetpack.clear(), localPose, look, false, IDLE_PARTS);
    const head = targets.head, equipment = art.rig.overlay;
    equipment.visible = !!head;
    equipment.clear();
    if (!head) return;
    equipment.position.set(head.start.x, head.start.y);
    equipment.rotation = head.rotation ?? 0;
    drawEars(equipment, look, IDLE_PARTS);
    drawHead(equipment, look);
};
