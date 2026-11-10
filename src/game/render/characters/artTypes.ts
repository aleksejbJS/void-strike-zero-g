// Original PNG coordinates and articulated source regions; no image pixels are rewritten.
import type { BodyId } from '../../build/bodyTypes';

export type XY = readonly [number, number];
export const ART_PARTS = [
    'head', 'torso', 'pelvis',
    'upperArmFront', 'upperArmBack', 'forearmFront', 'forearmBack', 'handFront', 'handBack',
    'thighFront', 'thighBack', 'shinFront', 'shinBack', 'footFront', 'footBack', 'tail',
    // 3D-kit hand poses: palms under the weapon, gripping fingers over it (only kit bodies have them)
    'palmFront', 'palmBack', 'handFrontGrip', 'handBackGrip',
] as const;
export type ArtPartId = typeof ART_PARTS[number];
export type ArtChannel = 'head' | 'torso' | 'arm' | 'leg' | 'none';

export interface SourcePart {
    polygon: readonly XY[];
    origin: XY;
    axisEnd?: XY;
    channel: ArtChannel;
    texture?: 'atlas';
    image?: { imagePath: string; size: XY }; // Pose/expression image overrides the shared atlas.
    pixelScale?: number; // World units per authored pixel, independent of source anatomy coordinates.
    supportHeight?: number; // Painted sole below the ankle pivot, in rig units for planted feet.
    preserveBlood?: boolean; // Custom head tint leaves original painted blood pixels crimson.
    paintOffset?: XY; // 3D kits: atlas px from this (untinted) picture to its tintable paint picture.
}

export interface BodyArtDefinition {
    id: BodyId;
    imagePath: string;
    size: XY;
    hip: XY;
    neck: XY;
    atlas?: { imagePath: string; size: XY };
    anatomy?: BodyArtDefinition; // Original shoulder/hip anchors are independent of atlas UVs.
    parts: Partial<Record<ArtPartId, SourcePart>>;
}
