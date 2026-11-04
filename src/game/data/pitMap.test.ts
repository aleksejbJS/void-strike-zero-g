import { describe, it, expect } from 'vitest';
import { GameMode, ItemType, MapId } from '../../types';
import { getInitialPickups, getPlatforms, getWaypoints } from './level';
import { PIT_PICKUPS, PIT_PLATFORMS, PIT_SPAWNS, PIT_WAYPOINTS } from './pitMap';
import { themeFor } from '../render/scene/mapLook';

const FIGHTER = { w: 30, h: 72 };
const hits = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('The Pit', () => {
    it('is mirrored about x=1300', () => {
        for (const p of PIT_PLATFORMS) {
            const twin = PIT_PLATFORMS.find(q => q.x === 2600 - p.x - p.w && q.y === p.y && q.w === p.w && q.h === p.h);
            expect(twin, `no mirror twin for ${JSON.stringify(p)}`).toBeDefined();
        }
    });

    it('fits a 2600x1400 box', () => {
        for (const p of PIT_PLATFORMS) {
            expect(p.x).toBeGreaterThanOrEqual(-200);
            expect(p.y).toBeGreaterThanOrEqual(-200);
            expect(p.x + p.w).toBeLessThanOrEqual(2800);
            expect(p.y + p.h).toBeLessThanOrEqual(1600);
        }
        expect(Math.max(...PIT_PLATFORMS.map(p => p.y))).toBe(1300); // the floor top
    });

    it('is closed: floor, ceiling and both walls', () => {
        expect(PIT_PLATFORMS.some(p => p.x === -200 && p.y === 1300 && p.x + p.w === 2800)).toBe(true);
        expect(PIT_PLATFORMS.some(p => p.x === -200 && p.y === -200 && p.x + p.w === 2800 && p.h === 200)).toBe(true);
        expect(PIT_PLATFORMS.some(p => p.x === -200 && p.w === 200 && p.y <= -200 && p.y + p.h >= 1300)).toBe(true);
        expect(PIT_PLATFORMS.some(p => p.x === 2600 && p.w === 200 && p.y <= -200 && p.y + p.h >= 1300)).toBe(true);
    });

    it('has no weapon pickups', () => {
        expect(PIT_PICKUPS.every(p => p.type !== ItemType.WEAPON)).toBe(true);
        const types = new Set(PIT_PICKUPS.map(p => p.type));
        expect([ItemType.HEALTH, ItemType.ARMOR, ItemType.AMMO].every(t => types.has(t))).toBe(true);
        expect(types.size).toBe(3);
    });

    it('pickups use the standard values and rest on a platform', () => {
        for (const p of PIT_PICKUPS) {
            if (p.type === ItemType.HEALTH) expect(p.value).toBe(25);
            if (p.type === ItemType.ARMOR) expect(p.value).toBe(50);
            const below = PIT_PLATFORMS.some(pl => p.pos.x > pl.x && p.pos.x < pl.x + pl.w && pl.y > p.pos.y && pl.y - p.pos.y <= 60);
            expect(below, `${p.id} floats over nothing`).toBe(true);
            const buried = PIT_PLATFORMS.some(pl => hits({ x: p.pos.x - 10, y: p.pos.y - 10, w: 20, h: 20 }, pl));
            expect(buried, `${p.id} is inside a platform`).toBe(false);
        }
        expect(new Set(PIT_PICKUPS.map(p => p.id)).size).toBe(PIT_PICKUPS.length);
    });

    it('spawns stand on the floor at mirrored x', () => {
        expect(PIT_SPAWNS[0].y).toBe(1300);
        expect(PIT_SPAWNS[1].y).toBe(1300);
        expect(PIT_SPAWNS[1].x).toBe(2600 - PIT_SPAWNS[0].x);
        expect(PIT_SPAWNS[0].x).toBeLessThan(1300);
    });

    it('spawns have clear air above the fighter (feet = pos)', () => {
        for (const s of PIT_SPAWNS) {
            const body = { x: s.x - FIGHTER.w / 2, y: s.y - FIGHTER.h - 1, w: FIGHTER.w, h: FIGHTER.h };
            expect(PIT_PLATFORMS.some(p => hits(body, p))).toBe(false);
        }
    });

    it('waypoints are in open air inside the box', () => {
        expect(PIT_WAYPOINTS.length).toBeGreaterThan(10);
        for (const w of PIT_WAYPOINTS) {
            expect(w.x).toBeGreaterThan(0);
            expect(w.x).toBeLessThan(2600);
            expect(PIT_PLATFORMS.some(p => w.x > p.x && w.x < p.x + p.w && w.y > p.y && w.y < p.y + p.h), `${w.x},${w.y} is in a solid`).toBe(false);
        }
    });
});

describe('The Pit hooks', () => {
    it('getPlatforms(DUEL) returns the pit', () => {
        const plats = getPlatforms(GameMode.DUEL, MapId.PIT);
        expect(plats.length).toBe(PIT_PLATFORMS.length);
        expect(new Set(plats.map(p => p.id)).size).toBe(plats.length);
    });

    it('getPlatforms(DUEL) does not need a map id', () => {
        expect(getPlatforms(GameMode.DUEL).length).toBe(PIT_PLATFORMS.length);
    });

    it('getWaypoints(DUEL) returns the pit waypoints', () => {
        expect(getWaypoints(GameMode.DUEL)).toEqual(PIT_WAYPOINTS);
    });

    it('getInitialPickups(DUEL) returns fresh copies, so a match cannot dirty the template', () => {
        const first = getInitialPickups(GameMode.DUEL, MapId.PIT);
        expect(first.map(p => p.id)).toEqual(PIT_PICKUPS.map(p => p.id));
        first[0].active = false;
        first[0].pos.x = -999;
        const second = getInitialPickups(GameMode.DUEL, MapId.PIT);
        expect(second[0].active).toBe(true);
        expect(second[0].pos.x).toBe(PIT_PICKUPS[0].pos.x);
        expect(PIT_PICKUPS[0].active).toBe(true);
    });

    it('themeFor(DUEL) is pit', () => {
        expect(themeFor(GameMode.DUEL, MapId.PIT)).toBe('pit');
        expect(themeFor(GameMode.DUEL, MapId.DEFAULT)).toBe('pit');
    });
});
