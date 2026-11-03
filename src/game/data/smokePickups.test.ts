import { describe, it, expect } from 'vitest';
import { GameMode, ItemType, MapId, WeaponType } from '../../types';
import { getInitialPickups, getPlatforms } from './level';
import { solidAt } from '../systems/botNavGraph';

const SMOKE_LAYOUTS: [GameMode, MapId][] = [
    [GameMode.DEATHMATCH, MapId.DEFAULT],
    [GameMode.DEATHMATCH, MapId.TUNNELS],
    [GameMode.CTF, MapId.DEFAULT],
    [GameMode.HOLD_THE_FLAG, MapId.DEFAULT],
    [GameMode.INFILTRATION, MapId.DEFAULT],
    [GameMode.HUNGER_GAMES, MapId.HUNGER],
];

const smokePickups = (mode: GameMode, map: MapId) =>
    getInitialPickups(mode, map).filter(p => p.type === ItemType.WEAPON && p.subtype === WeaponType.SMOKE_LAUNCHER);

describe('smoke launcher pickups', () => {
    it.each(SMOKE_LAYOUTS)('%s on %s has exactly one smoke launcher', (mode, map) => {
        const smoke = smokePickups(mode, map);
        expect(smoke).toHaveLength(1);
        expect(smoke[0].id.endsWith('_smoke')).toBe(true);
        expect(smoke[0].active).toBe(true);
    });

    it.each(SMOKE_LAYOUTS)('%s on %s: the smoke launcher floats just above a surface, not inside a platform', (mode, map) => {
        const platforms = getPlatforms(mode, map);
        const [smoke] = smokePickups(mode, map);
        const { x, y } = smoke.pos;
        expect(solidAt(platforms, x, y)).toBe(false);
        // Like the other weapon pickups it hangs within 60 px above a platform top
        const standsOn = platforms.some(p => x >= p.x && x <= p.x + p.w && p.y - y >= 0 && p.y - y <= 60);
        expect(standsOn).toBe(true);
    });

    it('Gun Game has no smoke launcher', () => {
        expect(smokePickups(GameMode.GUN_GAME, MapId.DEFAULT)).toEqual([]);
        expect(getInitialPickups(GameMode.GUN_GAME, MapId.DEFAULT).some(p => p.type === ItemType.WEAPON)).toBe(false);
    });

    it('pickup ids stay unique within each layout', () => {
        for (const [mode, map] of SMOKE_LAYOUTS) {
            const ids = getInitialPickups(mode, map).map(p => p.id);
            expect(new Set(ids).size).toBe(ids.length);
        }
    });
});
