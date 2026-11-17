import { describe, it, expect } from 'vitest';
import { GameMode, MapId, Platform, Team, Vector2 } from '../../types';
import { getInitialPickups, getPlatforms } from '../data/level';
import { BODY_PRESETS } from '../build/characterBases';
import { presetBuild } from '../build/buildPresets';
import { COVER_SPECS, CoverKind } from '../cover/coverTypes';
import { getCoverLayout, layoutKeyFor } from '../cover/coverLayout';
import { spawnPointFor } from '../net/roomSetup';
import { hitRect } from '../systems/hitZone';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../render/viewport';
import { checkRectOverlap, segmentIntersectsRect } from '../utils/math';
import { DUMMY_SPOTS, RANGE_CAMERA, RANGE_COVER, RANGE_PLATFORMS, RANGE_SPAWN } from './rangeMap';

type Rect = { x: number; y: number; w: number; h: number };
type PlatformDef = Omit<Platform, 'id'>;

const FIGHTER = { w: 30, h: 72 };
const CHEST = 40;            // chest height above the feet, where a shot at a dummy is aimed
const AIM_SLACK = 15;       // every line must clear what it passes by this much, so a slightly off aim still lands
const SHOOTER: Vector2 = { x: RANGE_SPAWN.x, y: RANGE_SPAWN.y - 50 }; // the spawn's standing chest

const floor = RANGE_PLATFORMS.find(p => p.y === 800 && p.x <= 0 && p.x + p.w >= 1500) as PlatformDef;
const ceiling = RANGE_PLATFORMS.find(p => p.y + p.h === 0 && p.x <= 0 && p.x + p.w >= 1500) as PlatformDef;
const leftWall = RANGE_PLATFORMS.find(p => p.x + p.w === 0 && p.y <= 0 && p.y + p.h >= 800) as PlatformDef;
const rightWall = RANGE_PLATFORMS.find(p => p.x === 1500 && p.y <= 0 && p.y + p.h >= 800) as PlatformDef;
const WALLS = [floor, ceiling, leftWall, rightWall];
const LEDGES = RANGE_PLATFORMS.filter(p => !WALLS.includes(p));
const INTERIOR: Rect = {
    x: leftWall.x + leftWall.w, y: ceiling.y + ceiling.h,
    w: rightWall.x - (leftWall.x + leftWall.w), h: floor.y - (ceiling.y + ceiling.h),
};

const grown = (r: Rect, by: number): Rect => ({ x: r.x - by, y: r.y - by, w: r.w + 2 * by, h: r.h + 2 * by });
const inside = (r: Rect, box: Rect) => r.x >= box.x && r.y >= box.y && r.x + r.w <= box.x + box.w && r.y + r.h <= box.y + box.h;
const coverRect = ([kind, x, y]: (typeof RANGE_COVER)[number]): Rect => {
    const { w, h } = COVER_SPECS[kind];
    return { x: x - w / 2, y: y - h, w, h };
};
const dummyRect = (pos: Vector2): Rect => ({ x: pos.x - FIGHTER.w / 2, y: pos.y - FIGHTER.h, w: FIGHTER.w, h: FIGHTER.h });
// The damage box of a standing dummy of this base (taller than the movement box for the drawn heads, the Cat's most)
const standingHitRect = (spot: (typeof DUMMY_SPOTS)[number]): Rect => hitRect({
    pos: spot.pos, width: FIGHTER.w, height: FIGHTER.h, isCrouching: false, isProne: false,
    skinId: spot.skinId, build: presetBuild(spot.skinId),
});

describe('range room', () => {
    it('is a closed box: floor, ceiling and both walls', () => {
        expect(WALLS.every(Boolean)).toBe(true);
        expect(INTERIOR).toEqual({ x: 0, y: 0, w: 1500, h: 800 });
        expect([leftWall.w, rightWall.w, ceiling.h]).toEqual([200, 200, 200]); // as thick as PIT_WALLS
    });

    it('fits the view: with the camera at RANGE_CAMERA the whole interior is on screen', () => {
        expect(INTERIOR.w).toBeLessThanOrEqual(1500);
        expect(INTERIOR.h).toBeLessThanOrEqual(800);
        const view: Rect = { x: RANGE_CAMERA.x - VIEW_WIDTH / 2, y: RANGE_CAMERA.y - VIEW_HEIGHT / 2, w: VIEW_WIDTH, h: VIEW_HEIGHT };
        expect(inside(INTERIOR, view)).toBe(true);
    });

    it('puts the camera at the room centre and the spawn on the floor inside the room', () => {
        expect(RANGE_CAMERA).toEqual({ x: INTERIOR.x + INTERIOR.w / 2, y: INTERIOR.y + INTERIOR.h / 2 });
        expect(RANGE_SPAWN.y).toBe(floor.y);
        expect(inside(dummyRect(RANGE_SPAWN), INTERIOR)).toBe(true);
    });
});

describe('range cover row', () => {
    it('has exactly one cover of each kind', () => {
        const kinds = RANGE_COVER.map(([kind]) => kind).sort();
        expect(kinds).toEqual((Object.keys(COVER_SPECS) as CoverKind[]).sort());
        expect(RANGE_COVER).toHaveLength(4);
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
