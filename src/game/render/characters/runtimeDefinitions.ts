// Complete atlas parts share the original picture's anatomical anchors and identity pixels.
import { BODY_IDS, type BodyId } from '../../build/bodyTypes';
import type { ArtPartId, BodyArtDefinition, SourcePart, XY } from './artTypes';
import { BODY_ART } from './definitions';
import { PART_ATLASES } from './data/articulatedAtlases';

export type AtlasPartId = 'torso' | 'pelvis' | 'upperArm' | 'forearm' | 'hand' | 'thigh' | 'shin' | 'foot';
export interface AtlasArtData {
    imagePath: string;
    size: XY;
    parts: Record<AtlasPartId, SourcePart>;
}

const ATLAS_SLOTS: Record<AtlasPartId, readonly ArtPartId[]> = {
    torso: ['torso'], pelvis: ['pelvis'], upperArm: ['upperArmFront', 'upperArmBack'],
    forearm: ['forearmFront', 'forearmBack'], hand: ['handFront', 'handBack'],
    thigh: ['thighFront', 'thighBack'], shin: ['shinFront', 'shinBack'], foot: ['footFront', 'footBack'],
};

export const createRuntimeArt = (original: BodyArtDefinition, atlas?: AtlasArtData): BodyArtDefinition => {
    if (!atlas) return original;
    const parts = { ...original.parts };
    for (const id of Object.keys(ATLAS_SLOTS) as AtlasPartId[]) {
        for (const slot of ATLAS_SLOTS[id]) parts[slot] = { ...atlas.parts[id], texture: 'atlas' };
    }
    return { ...original, anatomy: original, atlas: { imagePath: atlas.imagePath, size: atlas.size }, parts };
};

export const RUNTIME_BODY_ART = Object.fromEntries(BODY_IDS.map(id =>
    [id, createRuntimeArt(BODY_ART[id], PART_ATLASES[id])])) as Record<BodyId, BodyArtDefinition>;
