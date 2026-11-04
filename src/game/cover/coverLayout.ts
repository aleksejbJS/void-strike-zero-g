// Cover layouts per mode and map: which list applies, and fresh Cover objects built from it

import { GameMode, MapId } from '../../types';
import { COVER_LAYOUTS, CoverLayoutKey } from './coverLayouts';
import { COVER_SPECS, Cover } from './coverTypes';

/**
 * Which cover list a mode/map plays on. Mirrors the branching of getPlatforms (level.ts):
 * only Deathmatch looks at the map, Gun Game shares the CTF platforms, and the duel arena has no cover.
 */
export const layoutKeyFor = (mode: GameMode, map: MapId): CoverLayoutKey | null => {
    if (mode === GameMode.DUEL) return null;
    if (mode === GameMode.DEATHMATCH) return map === MapId.TUNNELS ? 'tunnels' : 'dm';
    if (mode === GameMode.HUNGER_GAMES) return 'hunger';
    if (mode === GameMode.HOLD_THE_FLAG) return 'htf';
    if (mode === GameMode.INFILTRATION) return 'infiltration';
    return 'ctf';
};

/** Full-HP cover for a mode/map, ids `cover_<key>_<index>`; new objects on every call (a match mutates them). */
export const getCoverLayout = (mode: GameMode, map: MapId): Cover[] => {
    const key = layoutKeyFor(mode, map);
    if (!key) return [];
    return COVER_LAYOUTS[key].map(([kind, x, y], i) => ({
        id: `cover_${key}_${i}`,
        kind,
        pos: { x, y },
        hp: COVER_SPECS[kind].hp,
    }));
};
