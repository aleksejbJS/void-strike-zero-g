// Human-only projected views and damage art; these do not imply arbitrary 3D view coverage.
import type { ArtPartId, SourcePart, XY } from '../artTypes';
import { HUMAN_CROUCH_PARTS } from './humanCrouch';
import { HUMAN_PRONE_PARTS } from './humanProne';

export type HumanArtPose = 'crouch' | 'prone';
export type HumanExpression = 'hurt' | 'dead';
export type HumanWound = 'arm' | 'leg' | 'neck' | 'waist';
export interface HumanPicture { imagePath: string; size: XY }
const DAMAGE = { imagePath: '/assets/characters/atompunk/human-v3/damage.png', size: [1536, 1024] as XY };

export const HUMAN_PICTURES: readonly HumanPicture[] = [
    { imagePath: '/assets/characters/atompunk/human-v3/crouch.png', size: [1254, 1254] },
    { imagePath: '/assets/characters/atompunk/human-v3/prone.png', size: [1254, 1254] }, DAMAGE,
];
export const HUMAN_POSE_PARTS: Partial<Record<HumanArtPose, Partial<Record<ArtPartId, SourcePart>>>> = {
    crouch: HUMAN_CROUCH_PARTS, prone: HUMAN_PRONE_PARTS,
};
const patch = (bounds: readonly [number, number, number, number], origin: XY, pixelScale: number): SourcePart => {
    const [x, y, right, bottom] = bounds;
    return { polygon: [[x, y], [right, y], [right, bottom], [x, bottom]],
        origin, pixelScale, channel: 'none', image: DAMAGE };
};

export const HUMAN_EXPRESSIONS: Partial<Record<HumanExpression, SourcePart>> = {
    hurt: { ...patch([8, 64, 395, 484], [248, 290], 0.060), channel: 'head', preserveBlood: true },
    dead: { ...patch([397, 64, 772, 490], [613, 289], 0.060), channel: 'head', preserveBlood: true },
};
export const HUMAN_WOUNDS: Partial<Record<HumanWound, SourcePart>> = {
    arm: patch([36, 655, 300, 900], [166, 755], 0.025),
    neck: patch([335, 650, 680, 920], [505, 760], 0.026),
    leg: patch([690, 640, 1090, 920], [891, 765], 0.025),
    waist: patch([1095, 630, 1535, 920], [1312, 764], 0.032),
};
