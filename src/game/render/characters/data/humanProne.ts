import type { ArtPartId, SourcePart } from '../artTypes';
import { humanPosePart as part } from './humanPosePart';

// Near and far surfaces are painted independently; prone heels face right and toes face backward.
export const HUMAN_PRONE_PARTS: Partial<Record<ArtPartId, SourcePart>> = {
    torso: part('prone', [14, 27, 307, 307], [55, 348], [230, 74], 0.043, 'torso'),
    pelvis: part('prone', [333, 100, 599, 291], [446, 251], [663, -90], 0.043, 'torso'),
    upperArmFront: part('prone', [678, 34, 896, 301], [823, 101], [732, 267], 0.030, 'arm'),
    upperArmBack: part('prone', [997, 40, 1196, 297], [1126, 102], [1050, 267], 0.027, 'arm'),
    forearmFront: part('prone', [71, 349, 234, 611], [132, 398], [194, 580], 0.032, 'arm'),
    forearmBack: part('prone', [401, 346, 545, 612], [475, 394], [508, 580], 0.029, 'arm'),
    handFront: part('prone', [690, 396, 882, 593], [773, 488], undefined, 0.028, 'arm'),
    handBack: part('prone', [1009, 396, 1198, 580], [1103, 489], undefined, 0.026, 'arm'),
    thighFront: part('prone', [21, 667, 296, 929], [221, 718], [81, 881], 0.029, 'leg'),
    thighBack: part('prone', [340, 689, 601, 911], [540, 737], [395, 867], 0.027, 'leg'),
    shinFront: part('prone', [701, 651, 876, 931], [816, 710], [748, 901], 0.031, 'leg'),
    shinBack: part('prone', [1020, 654, 1177, 930], [1120, 707], [1070, 900], 0.029, 'leg'),
    footFront: part('prone', [8, 1016, 306, 1203], [270, 1083], undefined, 0.038, 'none', 4.408),
    footBack: part('prone', [327, 1015, 617, 1200], [561, 1070], undefined, 0.038, 'none', 4.788),
};
