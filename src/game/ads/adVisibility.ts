// When an in-world ad place may load or refresh its banner, and when it should step back
// because the fight is in front of it. Pure logic, screen coordinates in CSS pixels.

export interface ScreenRect { x: number; y: number; w: number; h: number }

export const VIEW_SHARE = 0.5;   // at least half of the place on screen…
export const VIEW_MS = 1000;     // …for at least a second before a banner loads
export const MAX_LOADED = 3;     // phones: never more banners at once

/** Fraction (0..1) of the rectangle that lies on a screen of this size. */
export const visibleShare = (r: ScreenRect, screenW: number, screenH: number) => {
    if (r.w <= 0 || r.h <= 0) return 0;
    const w = Math.max(0, Math.min(r.x + r.w, screenW) - Math.max(r.x, 0));
    const h = Math.max(0, Math.min(r.y + r.h, screenH) - Math.max(r.y, 0));
    return (w * h) / (r.w * r.h);
};

export const intersects = (a: ScreenRect, b: ScreenRect) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Something from the fight (a fighter, a shot) is in front of the place. */
export const isOccluded = (place: ScreenRect, blockers: ScreenRect[]) => blockers.some(b => intersects(place, b));

export interface PlaceViewState {
    visibleSince: number | null;
    loadedAt: number | null;
}

export const newPlaceViewState = (): PlaceViewState => ({ visibleSince: null, loadedAt: null });

export type AdAction = 'none' | 'load' | 'refresh';

/**
 * Advance a place by one frame. Loads only after the place has been seen long enough
 * (TrafficStars counts the impression when its code runs) and refreshes only while seen.
 */
export const stepPlace = (s: PlaceViewState, share: number, now: number, refreshMs: number, loadedCount: number): AdAction => {
    if (share < VIEW_SHARE) {
        s.visibleSince = null;
        return 'none';
    }
    s.visibleSince ??= now;
    if (now - s.visibleSince < VIEW_MS) return 'none';
    if (s.loadedAt === null) {
        if (loadedCount >= MAX_LOADED) return 'none';
        s.loadedAt = now;
        return 'load';
    }
    if (now - s.loadedAt >= refreshMs) {
        s.loadedAt = now;
        return 'refresh';
    }
    return 'none';
};
