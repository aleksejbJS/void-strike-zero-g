import type { ArtPartId, SourcePart } from '../artTypes';
import { humanPosePart as part } from './humanPosePart';

export const HUMAN_CROUCH_PARTS: Partial<Record<ArtPartId, SourcePart>> = {
    torso: part('crouch', [15, 34, 316, 317], [69, 362], [240, 68], 0.044, 'torso'),
    pelvis: part('crouch', [330, 112, 619, 294], [477, 248], [650, -75], 0.044, 'torso'),
    upperArmFront: part('crouch', [672, 34, 914, 311], [835, 103], [744, 278], 0.032, 'arm'),
    upperArmBack: part('crouch', [1033, 49, 1189, 311], [1130, 103], [1092, 278], 0.027, 'arm'),
    forearmFront: part('crouch', [86, 332, 227, 610], [158, 388], [187, 583], 0.032, 'arm'),
    forearmBack: part('crouch', [411, 335, 536, 609], [461, 391], [508, 581], 0.029, 'arm'),
    handFront: part('crouch', [707, 380, 879, 566], [792, 477], undefined, 0.028, 'arm'),
    handBack: part('crouch', [1023, 383, 1186, 565], [1107, 477], undefined, 0.026, 'arm'),
    thighFront: part('crouch', [34, 634, 283, 934], [134, 701], [207, 883], 0.030, 'leg'),
    thighBack: part('crouch', [338, 649, 612, 920], [425, 716], [554, 865], 0.028, 'leg'),
    shinFront: part('crouch', [707, 634, 865, 927], [801, 693], [759, 896], 0.031, 'leg'),
    shinBack: part('crouch', [1025, 641, 1162, 922], [1112, 698], [1090, 895], 0.028, 'leg'),
    footFront: part('crouch', [34, 969, 285, 1239], [127, 1169], undefined, 0.038, 'none', 2.508),
    footBack: part('crouch', [344, 1005, 617, 1211], [434, 1141], undefined, 0.038, 'none', 2.508),
};
