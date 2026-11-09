import type { ArtPartId, BodyArtDefinition, SourcePart } from './artTypes';
import type { FighterState } from '../fighter/fighterPose';
import { HUMAN_EXPRESSIONS, HUMAN_POSE_PARTS } from './data/humanPoseVariants';
import { bodyPictureTexture } from './textures';

export type FighterExpression = 'normal' | 'hurt' | 'dead';

const selected = new WeakMap<BodyArtDefinition, Map<string, BodyArtDefinition>>();
const pictureReady = (part: SourcePart) => !part.image || !!bodyPictureTexture(part.image.imagePath);
const poseReady = (parts?: Partial<Record<ArtPartId, SourcePart>>): boolean => {
    if (!parts) return false;
    let found = false;
    for (const id in parts) {
        const part = parts[id as ArtPartId];
        if (part) { found = true; if (!pictureReady(part)) return false; }
    }
    return found;
};

/** Pose and facial pictures become available independently; incomplete poses retain the base art. */
export const selectHumanArt = (base: BodyArtDefinition, pose?: FighterState,
    expression: FighterExpression = 'normal'): BodyArtDefinition => {
    if (base.id !== 'human') return base;
    const candidate = pose === 'crouch' || pose === 'prone' ? HUMAN_POSE_PARTS[pose] : undefined;
    const parts = poseReady(candidate) ? candidate : undefined;
    const face = expression !== 'normal' ? HUMAN_EXPRESSIONS[expression] : undefined;
    const head = face && pictureReady(face) ? face : undefined;
    if (!parts && !head) return base;
    const key = `${parts ? pose : 'base'}:${head ? expression : 'normal'}`;
    let variants = selected.get(base);
    const cached = variants?.get(key);
    if (cached) return cached;
    const definition: BodyArtDefinition = { ...base, anatomy: base.anatomy ?? base,
        parts: { ...base.parts, ...parts, ...(head ? { head } : {}) } };
    if (!variants) { variants = new Map(); selected.set(base, variants); }
    variants.set(key, definition);
    return definition;
};
