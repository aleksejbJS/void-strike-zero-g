// Data shape of a body rendered from a 3D model as a two-layer puppet kit (tools/blender/render_kit.py).
import type { BodyId } from '../../build/bodyTypes';
import type { ArtChannel, ArtPartId, BodyArtDefinition, SourcePart, XY } from './artTypes';

/** One part of a kit: its anatomy in frame pixels, and where its pictures sit in the atlas. */
export interface KitPartData {
    polygon: readonly XY[];      // convex hull of the part's alpha, frame px (anatomy copy)
    origin: XY;                  // pivot, frame px
    axisEnd?: XY;                // bone end, frame px; absent for pivot-only parts (head, hands, feet)
    atlas: { polygon: readonly XY[]; origin: XY; axisEnd?: XY }; // the fixed (untinted) picture, atlas px
    paintOffset?: XY;            // atlas px from the fixed picture to its paint picture; absent = no paint
    channel: ArtChannel;         // builder colour that tints the paint picture
    supportHeight?: number;      // feet only: sole below the ankle pivot, rig units
}

export interface BodyKitData {
    frame: XY;                   // render frame size, px
    atlas: { imagePath: string; size: XY };
    hip: XY;                     // frame px
    neck: XY;                    // frame px
    parts: Partial<Record<ArtPartId, KitPartData>>;
}

/**
 * The kit as the renderer's two definitions: `anatomy` places joints in frame pixels (poses, corpses),
 * `runtime` draws atlas pictures at the frame's scale, with the paint picture `paintOffset` away.
 */
export const kitDefinitions = (kit: BodyKitData, id: BodyId): { anatomy: BodyArtDefinition; runtime: BodyArtDefinition } => {
    const pixelScale = 19 / Math.hypot(kit.neck[0] - kit.hip[0], kit.neck[1] - kit.hip[1]);
    const anatomyParts: Partial<Record<ArtPartId, SourcePart>> = {};
    const atlasParts: Partial<Record<ArtPartId, SourcePart>> = {};
    for (const [part, data] of Object.entries(kit.parts) as [ArtPartId, KitPartData][]) {
        anatomyParts[part] = { polygon: data.polygon, origin: data.origin, axisEnd: data.axisEnd, channel: data.channel };
        atlasParts[part] = {
            polygon: data.atlas.polygon, origin: data.atlas.origin, axisEnd: data.atlas.axisEnd, channel: data.channel,
            texture: 'atlas', pixelScale, paintOffset: data.paintOffset, supportHeight: data.supportHeight,
        };
    }
    const anatomy: BodyArtDefinition = { id, imagePath: kit.atlas.imagePath, size: kit.frame, hip: kit.hip, neck: kit.neck, parts: anatomyParts };
    return { anatomy, runtime: { ...anatomy, anatomy, atlas: kit.atlas, parts: atlasParts } };
};
