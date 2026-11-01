import { describe, it, expect } from 'vitest';
import { GameMode, MapId, Team } from '../../types';
import { getInitialPickups, getPlatforms, baseFlagPos } from './level';
import { ctfSpawnPoint } from '../net/roomSetup';

const inside = (p: { x: number; y: number; w: number; h: number }, x: number, y: number) =>
    x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h;

const REACH = 20;

describe('level data', () => {
    it.each([
        [GameMode.DEATHMATCH, MapId.DEFAULT],
        [GameMode.DEATHMATCH, MapId.TUNNELS],
        [GameMode.CTF, MapId.DEFAULT],
        [GameMode.HOLD_THE_FLAG, MapId.DEFAULT],
        [GameMode.INFILTRATION, MapId.DEFAULT],
        [GameMode.HUNGER_GAMES, MapId.HUNGER],
    ])('%s on %s: no pickup is buried inside a platform', (mode, map) => {
        const platforms = getPlatforms(mode, map);
        // Pickups are collected by touch: one at a platform's top or bottom edge can be reached
        const solid = (x: number, y: number) => platforms.some(p => inside(p, x, y));
        const buried = getInitialPickups(mode, map).filter(i => solid(i.pos.x, i.pos.y - REACH) && solid(i.pos.x, i.pos.y + REACH));
        expect(buried.map(i => i.id)).toEqual([]);
    });

    it('CTF teams respawn on open floor, well away from their own flag', () => {
        const platforms = getPlatforms(GameMode.CTF, MapId.DEFAULT);
        for (const team of [Team.BLUE, Team.RED] as const) {
            for (let i = 0; i < 20; i++) {
                const spawn = ctfSpawnPoint(team);
                expect(Math.abs(spawn.x - baseFlagPos(team).x)).toBeGreaterThan(500);
                expect(platforms.some(p => inside(p, spawn.x, spawn.y - 1) || inside(p, spawn.x, spawn.y - 72))).toBe(false);
            }
        }
    });
});
