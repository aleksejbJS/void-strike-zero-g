// Optional illustrated anatomy slots into the existing fighter's gear/weapon layer order.
import { ColorMatrixFilter } from 'pixi.js';
import { isBodyId } from '../../build/bodyTypes';
import type { FighterFrame, FighterView } from '../fighter/fighterView';
import { BODY_ART } from './definitions';
import { RUNTIME_BODY_ART } from './runtimeDefinitions';
import { bodyAtlasTexture, bodyPictureTexture, bodyTexture } from './textures';
import { selectHumanArt } from './humanArtSelector';
import { HUMAN_WOUNDS } from './data/humanPoseVariants';
import { createHumanWounds, destroyHumanWounds, humanLiveWoundTargets, updateHumanWounds } from './humanWounds';
import { createArtRig, destroyArtRig, updateArtRig, type ArtRig } from './rigView';
import { createRobotWounds, destroyRobotWounds, updateRobotWounds } from './robotWounds';
import { liveSockets } from './robotSockets';
import { drawHurtSparks, hurtBurst } from './robotHurtSparks';
import { upperPoint } from '../fighter/fighterPose';
import type { Texture } from 'pixi.js';
import { liveRigTargets } from './rigTargets';
import { drawPattern } from '../fighter/parts/patterns';
import { torsoPoint } from '../fighter/fighterDetails';

const clearHumanWounds = (view: FighterView): void => {
    if (view.humanWounds) destroyHumanWounds(view.humanWounds);
    view.humanWounds = undefined;
};

/** Every wound view goes when the illustrated body goes. */
const clearWounds = (view: FighterView): void => {
    clearHumanWounds(view);
    if (view.robotWounds) destroyRobotWounds(view.robotWounds);
    view.robotWounds = undefined;
};

/** A 3D-kit robot that lost its leg shows a torn hip with cables (instead of the blood stump). */
const syncRobotWounds = (view: FighterView, frame: FighterFrame, rig: ArtRig, atlas: Texture | undefined, hurt: boolean): void => {
    if (rig.definition.id !== 'robot' || !atlas) {
        if (view.robotWounds) destroyRobotWounds(view.robotWounds);
        view.robotWounds = undefined;
        return;
    }
    if (!view.robotWounds) {
        const wounds = createRobotWounds(atlas);
        if (!wounds) return;
        view.robotWounds = wounds;
        view.root.addChildAt(wounds.root, view.root.getChildIndex(rig.body)); // under the shorts and torso
    }
    const now = performance.now(), pose = frame.pose;
    updateRobotWounds(view.robotWounds, liveSockets(rig.definition, pose, !!frame.oneLeg), now / 1000);
    // A hurt robot shorts out at its joints, drawn over the arms and the weapon
    const sparks = view.robotWounds.sparks;
    if (sparks.parent !== view.root || view.root.children.at(-1) !== sparks) view.root.addChild(sparks);
    const anchors = [pose.head, upperPoint(pose, 0, -19), pose.shoulderFront, upperPoint(pose, 4, -12), pose.hip, pose.frontArm.joint, pose.frontLeg.joint];
    drawHurtSparks(sparks, hurt ? hurtBurst(anchors, view.robotWounds.seed, now) : null);
};

const syncWounds = (view: FighterView, frame: FighterFrame): void => {
    const definition = view.illustrated?.definition, image = HUMAN_WOUNDS.leg?.image;
    if (definition?.id !== 'human' || !image || !bodyPictureTexture(image.imagePath)) {
        clearHumanWounds(view); return;
    }
    if (!view.humanWounds && frame.oneLeg) {
        view.humanWounds = createHumanWounds(definition, bodyPictureTexture, ['hipBack']);
        if (view.humanWounds) view.root.addChild(view.humanWounds.root);
    }
    if (view.humanWounds) updateHumanWounds(view.humanWounds,
        humanLiveWoundTargets(definition, frame.pose, !!frame.oneLeg));
};

export const syncFighterArt = (view: FighterView, frame: FighterFrame): boolean => {
    const id = frame.look.build.body;
    const texture = isBodyId(id) ? bodyTexture(id) : undefined;
    if (!id || !texture || view.artFailure === id) {
        if (view.illustrated) { destroyArtRig(view.illustrated); view.illustrated = undefined; }
        clearWounds(view);
        if (view.artFlash) view.root.filters = null;
        return false;
    }
    const atlas = bodyAtlasTexture(id);
    const base = atlas && RUNTIME_BODY_ART[id].atlas ? RUNTIME_BODY_ART[id] : BODY_ART[id];
    const expression = frame.weaponless ? 'dead' : frame.expression
        ?? (frame.oneLeg || (frame.hitFlash ?? 0) > 0 ? 'hurt' : 'normal');
    const definition = selectHumanArt(base, frame.pose.state, expression);
    if (view.illustrated?.definition !== definition) {
        if (view.illustrated) destroyArtRig(view.illustrated);
        try {
            const rig = createArtRig(definition, texture, atlas, bodyPictureTexture);
            view.illustrated = rig;
            view.root.addChildAt(rig.tail, view.root.getChildIndex(view.body));
            view.root.addChildAt(rig.back, view.root.getChildIndex(view.ears));
            view.root.addChildAt(rig.body, view.root.getChildIndex(view.ears));
            view.root.addChildAt(rig.overlay, view.root.getChildIndex(view.ears));
            view.root.addChildAt(rig.head, view.root.getChildIndex(view.head));
            view.root.addChildAt(rig.front, view.root.getChildIndex(view.front));
            view.root.addChildAt(rig.under, view.root.getChildIndex(view.weapon));
            view.headKey = '';
        } catch (error) {
            view.artFailure = id;
            view.illustrated = undefined;
            clearWounds(view);
            console.error(`Character mesh "${id}" could not be created; using the existing fighter drawing:`, error);
            return false;
        }
    }
    const rig = view.illustrated;
    if (!rig) return false;
    const targets = liveRigTargets(rig.definition, frame.pose, frame.parts,
        frame.oneLeg, frame.headBob, frame.weaponless);
    updateArtRig(rig, targets, frame.look, frame.look.build.helmet !== 'none', frame.look.build.tail !== 'none');
    syncWounds(view, frame);
    syncRobotWounds(view, frame, rig, bodyAtlasTexture(id), expression === 'hurt');
    drawPattern(rig.overlay.clear(), (x, y) => torsoPoint(frame.pose, x, y), frame.look);
    const flash = frame.hitFlash ?? 0;
    if (flash > 0) {
        if (!view.artFlash) {
            const filter = new ColorMatrixFilter();
            view.artFlash = filter;
            view.root.on('destroyed', () => filter.destroy());
        }
        view.artFlash.brightness(1 + flash * 0.7, false);
        view.root.filters = [view.artFlash];
    } else if (view.artFlash) view.root.filters = null;
    return true;
};
