import { describe, it, expect } from 'vitest';
import { BACKDROP_CONTAINERS, DECAL_CONTAINER, Rect, STATION_AD_PLACES, layerToScreen } from './adPlaces';
import { themeFor } from './mapLook';
import { GameMode, MapId } from '../../../types';

// Camera positions the station maps can produce (their walls span x -2000..4000)
const CAMERAS: { x: number; y: number }[] = [];
for (let x = -2000; x <= 4000; x += 25) for (let y = -1000; y <= 820; y += 25) CAMERAS.push({ x, y });

const overlaps = (a: Rect, b: Rect, gap = 8) =>
    a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

describe('station ad places', () => {
    it('never overlap each other on screen, whatever the camera does', () => {
        for (const cam of CAMERAS) {
            const rects = STATION_AD_PLACES.map(p => layerToScreen(p, p.layer, cam, 1280, 720));
            for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
                expect(overlaps(rects[i], rects[j]), `${STATION_AD_PLACES[i].id} × ${STATION_AD_PLACES[j].id} at ${cam.x},${cam.y}`).toBe(false);
            }
        }
    });

    it('wall posters are never hidden behind the background cargo', () => {
        const cargo = BACKDROP_CONTAINERS.map(([x, y, w, h]) => ({ x, y, w, h }));
        for (const cam of CAMERAS) {
            for (const place of STATION_AD_PLACES.filter(p => p.layer === 'wall')) {
                const poster = layerToScreen(place, 'wall', cam, 1280, 720);
                for (const c of cargo) {
                    expect(overlaps(poster, layerToScreen(c, 'mid', cam, 1280, 720)), `${place.id} behind cargo at ${cam.x},${cam.y}`).toBe(false);
                }
            }
        }
    });

    it('the sticker container does not collide with the other cargo', () => {
        const decal = STATION_AD_PLACES.find(p => p.kind === 'decal')!;
        const box = { x: decal.x - DECAL_CONTAINER.padX, y: decal.y - DECAL_CONTAINER.padTop, w: decal.w + DECAL_CONTAINER.padX * 2, h: decal.h + DECAL_CONTAINER.padTop + DECAL_CONTAINER.padBottom };
        BACKDROP_CONTAINERS.forEach(([x, y, w, h]) => expect(overlaps(box, { x, y, w, h }, 0)).toBe(false)); // side by side is fine
    });

    it('creatives keep the banner proportions of their TrafficStars size', () => {
        for (const p of STATION_AD_PLACES) {
            const [bw, bh] = p.size.split('x').map(Number);
            expect(Math.abs(p.w / p.h - bw / bh)).toBeLessThan(0.06);
        }
    });
});

describe('map themes', () => {
    it('uses the station look for the default map and keeps the old look elsewhere for now', () => {
        expect(themeFor(GameMode.DEATHMATCH, MapId.DEFAULT)).toBe('station');
        expect(themeFor(GameMode.CTF, MapId.DEFAULT)).toBe('station');
        expect(themeFor(GameMode.DEATHMATCH, MapId.TUNNELS)).toBe('legacy');
        expect(themeFor(GameMode.HUNGER_GAMES, MapId.HUNGER)).toBe('legacy');
    });
});
