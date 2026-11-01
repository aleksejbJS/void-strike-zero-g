import { describe, it, expect } from 'vitest';
import { MAX_LOADED, VIEW_MS, isOccluded, newPlaceViewState, stepPlace, visibleShare } from './adVisibility';
import { validateAdConfig, looksLikeTrafficStars } from './adConfig';

describe('visibleShare', () => {
    it('measures how much of a place is on screen', () => {
        expect(visibleShare({ x: 10, y: 10, w: 100, h: 50 }, 800, 600)).toBe(1);
        expect(visibleShare({ x: -50, y: 10, w: 100, h: 50 }, 800, 600)).toBe(0.5);
        expect(visibleShare({ x: 900, y: 10, w: 100, h: 50 }, 800, 600)).toBe(0);
    });
});

describe('stepPlace', () => {
    const REFRESH = 60000;

    it('loads only after the place has been half visible for a second', () => {
        const s = newPlaceViewState();
        expect(stepPlace(s, 0.6, 0, REFRESH, 0)).toBe('none');
        expect(stepPlace(s, 0.6, VIEW_MS - 1, REFRESH, 0)).toBe('none');
        expect(stepPlace(s, 0.6, VIEW_MS, REFRESH, 0)).toBe('load');
        expect(stepPlace(s, 0.6, VIEW_MS + 10, REFRESH, 0)).toBe('none');
    });

    it('starts the second over when the place leaves the screen', () => {
        const s = newPlaceViewState();
        stepPlace(s, 0.6, 0, REFRESH, 0);
        stepPlace(s, 0.2, 600, REFRESH, 0);
        expect(stepPlace(s, 0.6, 1100, REFRESH, 0)).toBe('none');
        expect(stepPlace(s, 0.6, 2100, REFRESH, 0)).toBe('load');
    });

    it('refreshes only while visible and not more often than the interval', () => {
        const s = newPlaceViewState();
        stepPlace(s, 1, 0, REFRESH, 0);
        stepPlace(s, 1, VIEW_MS, REFRESH, 0); // loaded
        expect(stepPlace(s, 0, VIEW_MS + REFRESH, REFRESH, 1)).toBe('none');
        expect(stepPlace(s, 1, VIEW_MS + REFRESH + 1, REFRESH, 1)).toBe('none'); // must be seen for a second again
        expect(stepPlace(s, 1, VIEW_MS * 2 + REFRESH + 1, REFRESH, 1)).toBe('refresh');
    });

    it('never loads more than the limit at once', () => {
        const s = newPlaceViewState();
        stepPlace(s, 1, 0, REFRESH, MAX_LOADED);
        expect(stepPlace(s, 1, VIEW_MS, REFRESH, MAX_LOADED)).toBe('none');
        expect(stepPlace(s, 1, VIEW_MS + 1, REFRESH, MAX_LOADED - 1)).toBe('load');
    });
});

describe('isOccluded', () => {
    it('sees a fighter in front of the place', () => {
        const place = { x: 100, y: 100, w: 120, h: 100 };
        expect(isOccluded(place, [{ x: 150, y: 150, w: 30, h: 72 }])).toBe(true);
        expect(isOccluded(place, [{ x: 400, y: 150, w: 30, h: 72 }])).toBe(false);
    });
});

describe('ads.json', () => {
    it('accepts places with a known size and turns off places without code', () => {
        const r = validateAdConfig({ version: 1, refreshSec: 5, places: {
            'station.wall-poster-a': { enabled: true, size: '300x250', code: '<script src="https://cdn.tsyndicate.com/x.js"></script>' },
            'station.led-panel': { enabled: true, size: '728x90', code: '' },
            'station.bad': { enabled: true, size: '1x1', code: 'x' },
        } });
        expect(r.ok).toBe(true);
        if (r.ok === false) return;
        expect(r.config.refreshSec).toBe(30); // clamped: no ad refresh spam
        expect(r.config.places['station.wall-poster-a'].enabled).toBe(true);
        expect(r.config.places['station.led-panel'].enabled).toBe(false);
        expect(r.config.places['station.bad']).toBeUndefined();
        expect(r.warnings).toHaveLength(1);
    });

    it('rejects a file of the wrong shape', () => {
        expect(validateAdConfig(null).ok).toBe(false);
        expect(validateAdConfig({ version: 2, places: {} }).ok).toBe(false);
    });

    it('recognises TrafficStars code', () => {
        expect(looksLikeTrafficStars('<script src="//cdn.tsyndicate.com/sdk/v1/bi.js"></script>')).toBe(true);
        expect(looksLikeTrafficStars('<div>hello</div>')).toBe(false);
    });
});
