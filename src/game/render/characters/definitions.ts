import type { BodyId } from '../../build/bodyTypes';
import type { BodyArtDefinition } from './artTypes';
import { CAT_ART } from './data/cat';
import { FEMALE_ART } from './data/female';
import { HUMAN_ART } from './data/human';
import { ROBOT_KIT } from './data/robotKit';
import { kitDefinitions } from './kitTypes';
import { TOXIC_ART } from './data/toxic';

/** Bodies rendered from 3D models (tools/blender): anatomy for poses and corpses, runtime for drawing. */
export const KIT_ART: Partial<Record<BodyId, ReturnType<typeof kitDefinitions>>> = {
    robot: kitDefinitions(ROBOT_KIT, 'robot'),
};

export const BODY_ART: Record<BodyId, BodyArtDefinition> = {
    human: HUMAN_ART,
    'human-female': FEMALE_ART,
    robot: KIT_ART.robot!.anatomy,
    toxic: TOXIC_ART,
    cat: CAT_ART,
};
