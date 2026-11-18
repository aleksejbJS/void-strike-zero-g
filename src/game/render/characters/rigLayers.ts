// 3D-kit paint layer: a second mesh under a part's fixed picture that samples its neutral paint picture
// (`paintOffset` away in the atlas) and carries the builder colour. The fixed picture is never tinted.
import { Mesh, MeshGeometry, Texture } from 'pixi.js';
import type { SourcePart, XY } from './artTypes';
import { partGeometry } from './placement';

/** The paint mesh for a kit part, or undefined when the part has no paint pixels. */
export const createPaintMesh = (source: SourcePart, size: XY, texture: Texture): Mesh | undefined => {
    if (!source.paintOffset) return undefined;
    const base = partGeometry(source, size);
    const [dx, dy] = [source.paintOffset[0] / size[0], source.paintOffset[1] / size[1]];
    const uvs = new Float32Array(base.uvs.length);
    for (let i = 0; i < uvs.length; i += 2) {
        uvs[i] = base.uvs[i] + dx;
        uvs[i + 1] = base.uvs[i + 1] + dy;
    }
    const geometry = new MeshGeometry({ positions: base.positions, uvs, indices: base.indices });
    const mesh = new Mesh({ geometry, texture });
    mesh.on('destroyed', () => geometry.destroy(true));
    return mesh;
};

/** Places the paint mesh exactly on its fixed mesh and tints it with the builder colour. */
export const syncPaint = (paint: Mesh, fixed: Mesh, tint: number): void => {
    paint.visible = fixed.visible;
    paint.position.copyFrom(fixed.position);
    paint.rotation = fixed.rotation;
    paint.scale.copyFrom(fixed.scale);
    paint.tint = tint;
};
