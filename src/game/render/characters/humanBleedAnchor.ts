// Blood follows the same painted stump as the renderer, while unavailable artwork keeps legacy FX.
import type { Vector2 } from '../../../types';
import type { FighterPose } from '../fighter/fighterPose';
import { HUMAN_WOUNDS } from './data/humanPoseVariants';
import { BODY_ART } from './definitions';
import { selectHumanArt } from './humanArtSelector';
import { humanLiveWoundTargets } from './humanWounds';
import { RUNTIME_BODY_ART } from './runtimeDefinitions';
import { bodyAtlasTexture, bodyPictureTexture, bodyTexture } from './textures';

export const humanBleedAnchor = (body: unknown, pose: FighterPose): Vector2 | undefined => {
    const image = HUMAN_WOUNDS.leg?.image;
    if (body !== 'human' || !bodyTexture('human') || !image || !bodyPictureTexture(image.imagePath)) return undefined;
    const base = bodyAtlasTexture('human') && RUNTIME_BODY_ART.human.atlas ? RUNTIME_BODY_ART.human : BODY_ART.human;
    const definition = selectHumanArt(base, pose.state, 'hurt');
    return humanLiveWoundTargets(definition, pose, true).hipBack?.start;
};
