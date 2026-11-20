import { describe, it, expect } from 'vitest';
import { GameMode, MapId, Team } from '../../types';
import { getInitialPickups, getPlatforms } from '../data/level';
import { BODY_PRESETS } from '../build/characterBases';
import { COVER_SPECS } from '../cover/coverTypes';
import { getCoverLayout, layoutKeyFor } from '../cover/coverLayout';
import { spawnPointFor } from '../net/roomSetup';
import { viewportOf } from '../render/viewport';
import type { Viewport } from '../render/viewport';
import { dummyReadoutTop } from '../render/range/readoutLayout';
import { checkRectOverlap, segmentIntersectsRect } from '../utils/math';
import { DUMMY_SPOTS, RANGE_CAMERA, RANGE_COVER, RANGE_PLATFORMS, RANGE_SPAWN } from './rangeMap';
import {
    LEDGES, SHOOTER, WALLS, ceiling, coverRect, dummyHitRect, dummyRect, floor, grown, inside, leftWall, rightWall,
} from './rangeMapTestKit';
import type { DummySpot, Rect } from './rangeMapTestKit';

const CHEST = 40;            // chest height above the feet, where a shot at a dummy is aimed
const AIM_SLACK = 15;       // every line must clear what it passes by this much, so a slightly off aim still lands

const INTERIOR: Rect = {
    x: leftWall.x + leftWall.w, y: ceiling.y + ceiling.h,
    w: rightWall.x - (leftWall.x + leftWall.w), h: floor.y - (ceiling.y + ceiling.h),
};
const standingHitRect = (spot: DummySpot): Rect => dummyHitRect(spot, 'stand');

describe('range room', () => {
    it('is a closed box: floor, ceiling and both walls', () => {
        expect(WALLS.every(Boolean)).toBe(true);
        expect(INTERIOR).toEqual({ x: 0, y: 0, w: 1500, h: 800 });
        expect([leftWall.w, rightWall.w, ceiling.h]).toEqual([200, 200, 200]); // as thick as PIT_WALLS
    });

    it('puts the camera at the room\'s horizontal centre and the spawn on the floor inside the room', () => {
        expect(RANGE_CAMERA.x).toBe(INTERIOR.x + INTERIOR.w / 2);
        expect(RANGE_SPAWN.y).toBe(floor.y);
        expect(inside(dummyRect(RANGE_SPAWN), INTERIOR)).toBe(true);
    });

    // The fixed camera vs the desktop HUD's bottom band: the weapon bar is `bottom-8` (32 px) with `h-[72px]` slots
    // (WeaponBar.tsx), its top 104 CSS px above the page bottom. The vitals panel is hidden in the range.
    const HUD_BOTTOM_BAND_PX = 32 + 72;
    const screenX = (x: number, view: Viewport) => (x - RANGE_CAMERA.x + view.w / 2) * view.zoom;
    const screenY = (y: number, view: Viewport) => (y - RANGE_CAMERA.y + view.h / 2) * view.zoom;

    for (const [w, h] of [[1512, 700], [1920, 1080]]) {
        describe(`fits a ${w}x${h} page with the camera at RANGE_CAMERA`, () => {
            const view = viewportOf(w, h);
            const bandTop = h - HUD_BOTTOM_BAND_PX;

            it('shows the room from wall to wall', () => {
                expect([screenX(INTERIOR.x, view) >= 0, screenX(INTERIOR.x + INTERIOR.w, view) <= w]).toEqual([true, true]);
            });

            it('keeps the floor, every cover piece and the spawn fighter above the weapon bar', () => {
                expect(screenY(floor.y, view)).toBeLessThan(bandTop);
                for (const entry of RANGE_COVER) {
                    const r = coverRect(entry);
                    expect(screenY(r.y + r.h, view), `${entry[0]} is under the HUD`).toBeLessThan(bandTop);
                }
                expect(screenY(RANGE_SPAWN.y, view)).toBeLessThan(bandTop);
            });

            it('keeps every standing dummy\'s readout below the top of the page', () => {
                for (const spot of DUMMY_SPOTS) {
                    expect(screenY(dummyReadoutTop(standingHitRect(spot).y), view), `${spot.skinId} readout is cut off`).toBeGreaterThan(0);
                }
            });
        });
    }
});

describe('range cover row', () => {
    it('has the four training props', () => {
        const kinds = RANGE_COVER.map(([kind]) => kind).sort();
        expect(kinds).toEqual(['barrel', 'glass', 'metal', 'wood']);
    });

    it('stands on the floor inside the room, clear of the spawn and of each other', () => {
        RANGE_COVER.forEach((entry, i) => {
            const r = coverRect(entry);
            expect(entry[2], `${entry[0]} is not on the floor`).toBe(floor.y);
            expect(inside(r, INTERIOR), `${entry[0]} is outside the room`).toBe(true);
            expect(checkRectOverlap(r, dummyRect(RANGE_SPAWN)), `${entry[0]} is on the spawn`).toBe(false);
            for (const other of RANGE_COVER.slice(i + 1)) {
                expect(checkRectOverlap(r, coverRect(other))).toBe(false);
            }
        });
    });
});

describe('range dummy spots', () => {
    it('has five spots, one per body preset', () => {
        const ids = BODY_PRESETS.map(p => p.id).sort();
        expect(DUMMY_SPOTS.map(s => s.skinId).sort()).toEqual(ids);
        expect(ids).toHaveLength(5);
    });

    it('every spot stands on a surface, inside the room, clear of the others', () => {
        DUMMY_SPOTS.forEach((spot, i) => {
            const r = dummyRect(spot.pos);
            expect(inside(r, INTERIOR), `${spot.skinId} is outside the room`).toBe(true);
            const support = RANGE_PLATFORMS.find(p => p.y === spot.pos.y && r.x >= p.x && r.x + r.w <= p.x + p.w);
            expect(support, `${spot.skinId} has no surface under it`).toBeDefined();
            for (const p of RANGE_PLATFORMS) expect(checkRectOverlap(r, p), `${spot.skinId} is inside a platform`).toBe(false);
            for (const other of DUMMY_SPOTS.slice(i + 1)) expect(checkRectOverlap(r, dummyRect(other.pos))).toBe(false);
        });
    });

    it('has a clear line of sight from the spawn to every dummy chest past all cover and ledges', () => {
        for (const spot of DUMMY_SPOTS) {
            const chest = { x: spot.pos.x, y: spot.pos.y - CHEST };
            for (const entry of RANGE_COVER) {
                expect(segmentIntersectsRect(SHOOTER, chest, grown(coverRect(entry), AIM_SLACK)), `${entry[0]} blocks ${spot.skinId}`).toBe(false);
            }
            for (const ledge of LEDGES) {
                expect(segmentIntersectsRect(SHOOTER, chest, grown(ledge, AIM_SLACK)), `a ledge blocks ${spot.skinId}`).toBe(false);
            }
        }
    });

    it('lets a shot from the spawn reach every dummy chest without crossing another dummy', () => {
        for (const spot of DUMMY_SPOTS) {
            const chest = { x: spot.pos.x, y: spot.pos.y - CHEST };
            for (const other of DUMMY_SPOTS.filter(o => o !== spot)) {
                expect(
                    segmentIntersectsRect(SHOOTER, chest, grown(standingHitRect(other), AIM_SLACK)),
                    `${other.skinId} stands in the line to ${spot.skinId}`,
                ).toBe(false);
            }
        }
    });

    it('gives every dummy its own narrow ledge', () => {
        expect(LEDGES).toHaveLength(DUMMY_SPOTS.length);
        for (const spot of DUMMY_SPOTS) {
            const own = LEDGES.filter(p => p.y === spot.pos.y && spot.pos.x >= p.x && spot.pos.x <= p.x + p.w);
            expect(own, `${spot.skinId} has no ledge of its own`).toHaveLength(1);
            expect(own[0].w).toBeLessThanOrEqual(60);
        }
    });

    it('puts the dummies farther from the spawn than any piece of cover', () => {
        const dist = (x: number) => Math.abs(x - RANGE_SPAWN.x);
        const farthestCover = Math.max(...RANGE_COVER.map(([, x]) => dist(x)));
        expect(Math.min(...DUMMY_SPOTS.map(s => dist(s.pos.x)))).toBeGreaterThan(farthestCover);
    });
});

describe('range wiring', () => {
    it('getPlatforms(RANGE) is the range room, with ids', () => {
        const platforms = getPlatforms(GameMode.RANGE, MapId.DEFAULT);
        expect(platforms).toHaveLength(RANGE_PLATFORMS.length);
        platforms.forEach((p, i) => expect(p).toMatchObject(RANGE_PLATFORMS[i]));
        expect(new Set(platforms.map(p => p.id)).size).toBe(platforms.length);
    });

    it('has no pickups', () => {
        expect(getInitialPickups(GameMode.RANGE)).toEqual([]);
    });

    it('lays out the four cover pieces as cover_range_0..3, at full HP', () => {
        expect(layoutKeyFor(GameMode.RANGE, MapId.DEFAULT)).toBe('range');
        expect(layoutKeyFor(GameMode.RANGE, MapId.TUNNELS)).toBe('range');
        const layout = getCoverLayout(GameMode.RANGE, MapId.DEFAULT);
        expect(layout.map(c => c.id)).toEqual(['cover_range_0', 'cover_range_1', 'cover_range_2', 'cover_range_3']);
        expect(layout.map(c => [c.kind, c.pos.x, c.pos.y])).toEqual(RANGE_COVER.map(e => [...e]));
        for (const c of layout) expect(c.hp).toBe(COVER_SPECS[c.kind].hp);
    });

    it('spawns on RANGE_SPAWN, as a fresh copy, for every team', () => {
        for (const team of [Team.NONE, Team.BLUE, Team.RED]) {
            const p = spawnPointFor(GameMode.RANGE)(team);
            expect(p).toEqual(RANGE_SPAWN);
            expect(p).not.toBe(RANGE_SPAWN);
        }
    });
});
