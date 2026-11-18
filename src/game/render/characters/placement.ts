// Source polygons are expressed in their bone frame; runtime transforms follow existing joints.
import type { Vector2 } from '../../../types';
import type { BodyArtDefinition, SourcePart, XY } from './artTypes';
import { triangulatePolygon } from './triangulate';

export interface ArtTarget { start: Vector2; end?: Vector2; rotation?: number; visible?: boolean }
export interface ArtPlacement { x: number; y: number; rotation: number; scaleX: number; scaleY: number; visible: boolean }

export const artScale = (definition: BodyArtDefinition): number => {
    const length = Math.hypot(definition.neck[0] - definition.hip[0], definition.neck[1] - definition.hip[1]);
    if (length <= 0) throw new Error(`Character ${definition.id} has no torso axis`);
    return 19 / length;
};

export const partGeometry = (part: SourcePart, size: XY) => {
    const dx = part.axisEnd ? part.axisEnd[0] - part.origin[0] : 0;
    const dy = part.axisEnd ? part.axisEnd[1] - part.origin[1] : 1;
    const length = Math.hypot(dx, dy);
    if (length <= 0 || size.some(n => !Number.isFinite(n) || n <= 0)) throw new Error('Invalid character part dimensions');
    const positions = new Float32Array(part.polygon.flatMap(([x, y]) => {
        const rx = x - part.origin[0], ry = y - part.origin[1];
        return [(rx * dy - ry * dx) / length, (rx * dx + ry * dy) / length];
    }));
    const uvs = new Float32Array(part.polygon.flatMap(([x, y]) => [x / size[0], y / size[1]]));
    return { positions, uvs, indices: triangulatePolygon(part.polygon) };
};

export const placePart = (part: SourcePart, target: ArtTarget, scale: number): ArtPlacement => {
    const pixelScale = part.pixelScale ?? scale;
    if (!Number.isFinite(pixelScale) || pixelScale <= 0) throw new Error('Invalid character part pixel scale');
    const result = { x: target.start.x, y: target.start.y, rotation: target.rotation ?? 0,
        scaleX: pixelScale, scaleY: pixelScale, visible: target.visible !== false };
    if (target.end) {
        if (!part.axisEnd) throw new Error('A bone target requires an authored source axis');
        const sourceLength = Math.hypot(part.axisEnd[0] - part.origin[0], part.axisEnd[1] - part.origin[1]);
        if (sourceLength <= 0) throw new Error('Character source bone has zero length');
        const dx = target.end.x - target.start.x, dy = target.end.y - target.start.y;
        const length = Math.hypot(dx, dy);
        result.rotation = Math.atan2(dy, dx) - Math.PI / 2;
        result.scaleY = length / sourceLength;
        result.visible &&= length > 1e-7;
    }
    return result;
};
