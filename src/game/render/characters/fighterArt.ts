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
import { createArtRig, destroyArtRig, updateArtRig } from './rigView';
import { liveRigTargets } from './rigTargets';
import { drawPattern } from '../fighter/parts/patterns';
import { torsoPoint } from '../fighter/fighterDetails';

const clearWounds = (view: FighterView): void => {
    if (view.humanWounds) destroyHumanWounds(view.humanWounds);
    view.humanWounds = undefined;
};

const syncWounds = (view: FighterView, frame: FighterFrame): void => {
    const definition = view.illustrated?.definition, image = HUMAN_WOUNDS.leg?.image;
    if (definition?.id !== 'human' || !image || !bodyPictureTexture(image.imagePath)) {
        clearWounds(view); return;
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
