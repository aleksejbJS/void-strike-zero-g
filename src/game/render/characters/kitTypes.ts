// Data shape of a body rendered from a 3D model as a two-layer puppet kit (tools/blender/render_kit.py).
import type { ArtChannel, ArtPartId, XY } from './artTypes';

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
