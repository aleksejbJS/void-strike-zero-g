import { describe, it, expect } from 'vitest';
import { AdPlace, BACKDROP_CONTAINERS, DECAL_CONTAINER, Rect, STATION_AD_PLACES, layerToScreen, tiledRectsIn } from './adPlaces';
import { themeFor } from './mapLook';
import { MINE_AD_PLACES, MINE_DECOR_RECTS } from './themes/mineTheme';
import { ARENA_AD_PLACES, ARENA_DECOR_RECTS } from './themes/arenaTheme';
import { PIT_AD_PLACES, PIT_DECOR_RECTS } from './themes/pitTheme';
import { GameMode, MapId } from '../../../types';

const cameras = (x0: number, x1: number, y0: number, y1: number) => {
    const list: { x: number; y: number }[] = [];
    for (let x = x0; x <= x1; x += 25) for (let y = y0; y <= y1; y += 25) list.push({ x, y });
    return list;
};

// Each theme with the camera positions its maps can produce (between their outer walls)
const THEMES: { name: string; places: AdPlace[]; decor: Rect[]; cams: { x: number; y: number }[] }[] = [
    { name: 'station', places: STATION_AD_PLACES, decor: BACKDROP_CONTAINERS.map(([x, y, w, h]) => ({ x, y, w, h })), cams: cameras(-2000, 4000, -1000, 820) },
    { name: 'mine', places: MINE_AD_PLACES, decor: MINE_DECOR_RECTS, cams: cameras(-2000, 4000, -900, 900) },
    { name: 'arena', places: ARENA_AD_PLACES, decor: ARENA_DECOR_RECTS, cams: cameras(-2800, 5800, -1800, 1400) },
    // The Pit's camera follows fighters inside its 2600x1400 box
    { name: 'pit', places: PIT_AD_PLACES, decor: PIT_DECOR_RECTS, cams: cameras(0, 2600, 0, 1400) },
];

const overlaps = (a: Rect, b: Rect, gap = 8) =>
    a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

describe.each(THEMES)('$name ad places', ({ places, decor, cams }) => {
    it('never overlap each other on screen, whatever the camera does', () => {
        for (const cam of cams) {
            const rects = places.map(p => layerToScreen(p, p.layer, cam, 1280, 720));
            for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
                expect(overlaps(rects[i], rects[j]), `${places[i].id} × ${places[j].id} at ${cam.x},${cam.y}`).toBe(false);
            }
        }
    });

    it('wall places are never hidden behind the background decor', () => {
        for (const cam of cams) {
            for (const place of places.filter(p => p.layer === 'wall')) {
                const poster = layerToScreen(place, 'wall', cam, 1280, 720);
                for (const c of decor) {
                    expect(overlaps(poster, layerToScreen(c, 'mid', cam, 1280, 720)), `${place.id} behind decor at ${cam.x},${cam.y}`).toBe(false);
                }
            }
        }
    });

    it('creatives keep the banner proportions of their TrafficStars size', () => {
        for (const p of places) {
            const [bw, bh] = p.size.split('x').map(Number);
            expect(Math.abs(p.w / p.h - bw / bh)).toBeLessThan(0.06);
        }
    });
});

describe('station sticker', () => {
    it('the sticker container does not collide with the other cargo', () => {
        const decal = STATION_AD_PLACES.find(p => p.kind === 'decal')!;
        const box = { x: decal.x - DECAL_CONTAINER.padX, y: decal.y - DECAL_CONTAINER.padTop, w: decal.w + DECAL_CONTAINER.padX * 2, h: decal.h + DECAL_CONTAINER.padTop + DECAL_CONTAINER.padBottom };
        BACKDROP_CONTAINERS.forEach(([x, y, w, h]) => expect(overlaps(box, { x, y, w, h }, 0)).toBe(false)); // side by side is fine
    });

});

describe('map themes', () => {
    it('gives every map its own look', () => {
        expect(themeFor(GameMode.DEATHMATCH, MapId.DEFAULT)).toBe('station');
        expect(themeFor(GameMode.CTF, MapId.DEFAULT)).toBe('station');
        expect(themeFor(GameMode.DEATHMATCH, MapId.TUNNELS)).toBe('mine');
        expect(themeFor(GameMode.GUN_GAME, MapId.TUNNELS)).toBe('mine');
        expect(themeFor(GameMode.HUNGER_GAMES, MapId.HUNGER)).toBe('arena');
        expect(themeFor(GameMode.DUEL, MapId.PIT)).toBe('pit');
    });

    it('ad place ids are unique across all maps (they are keys in ads.json)', () => {
        const ids = THEMES.flatMap(t => t.places.map(p => p.id));
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('tiledRectsIn', () => {
    const tile = { tileW: 1000, tileH: 800, rects: [{ x: 100, y: 0, w: 40, h: 800 }] };

    it('finds every copy of a repeating girder in front of a place', () => {
        const hits = tiledRectsIn(tile, { x: -50, y: 30 }, { x: 0, y: 0, w: 1200, h: 100 });
        expect([...new Set(hits.map(r => r.x))].sort((a, b) => a - b)).toEqual([50, 1050]);
        hits.forEach(r => expect(r.w).toBe(40));
    });

    it('finds nothing when the girders pass beside the place', () => {
        expect(tiledRectsIn(tile, { x: 0, y: 0 }, { x: 200, y: 10, w: 300, h: 50 })).toEqual([]);
    });
});
