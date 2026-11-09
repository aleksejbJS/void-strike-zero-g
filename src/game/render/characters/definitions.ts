import type { BodyId } from '../../build/bodyTypes';
import type { BodyArtDefinition } from './artTypes';
import { CAT_ART } from './data/cat';
import { FEMALE_ART } from './data/female';
import { HUMAN_ART } from './data/human';
import { ROBOT_ART } from './data/robot';
import { TOXIC_ART } from './data/toxic';

export const BODY_ART: Record<BodyId, BodyArtDefinition> = {
    human: HUMAN_ART,
    'human-female': FEMALE_ART,
    robot: ROBOT_ART,
    toxic: TOXIC_ART,
    cat: CAT_ART,
};
