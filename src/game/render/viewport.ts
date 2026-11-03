// The camera shows a fixed slice of the world, whatever the window size: everything in camera
// space is drawn on a "virtual screen" of about VIEW_WIDTH × VIEW_HEIGHT world units and then
// scaled by `zoom` to fill the window. Big monitors no longer see more of the map than small ones.

import { Vector2 } from '../../types';

export const VIEW_WIDTH = 1600;
export const VIEW_HEIGHT = 900;
// Phones would otherwise shrink fighters to a few pixels; they see a bit less of the map instead
export const MIN_ZOOM = 0.6;

export interface Viewport {
    zoom: number; // screen pixels per world unit
    w: number;    // virtual screen width in world units
    h: number;    // virtual screen height in world units
}

/** Zoom that shows at least VIEW_WIDTH × VIEW_HEIGHT; the extra on a non-16:9 window is shown, not cut. */
export const viewportOf = (screenW: number, screenH: number): Viewport => {
    const fit = Math.min(screenW / VIEW_WIDTH, screenH / VIEW_HEIGHT);
    const zoom = Number.isFinite(fit) && fit > 0 ? Math.max(MIN_ZOOM, fit) : 1;
    return { zoom, w: screenW / zoom, h: screenH / zoom };
};

/** A point in window pixels (mouse, touch) on the virtual screen. */
export const toView = (p: Vector2, view: Viewport): Vector2 => ({ x: p.x / view.zoom, y: p.y / view.zoom });

/** A world point in window pixels: the inverse of `screenToWorld`. */
export const worldToScreen = (p: Vector2, camera: Vector2, view: Viewport): Vector2 => ({
    x: (p.x - camera.x + view.w / 2) * view.zoom,
    y: (p.y - camera.y + view.h / 2) * view.zoom,
});

/** A point in window pixels in the world, for a camera centred on `camera`. */
export const screenToWorld = (p: Vector2, camera: Vector2, view: Viewport): Vector2 => {
    const v = toView(p, view);
    return { x: v.x - view.w / 2 + camera.x, y: v.y - view.h / 2 + camera.y };
};
