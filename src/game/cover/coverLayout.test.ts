import { describe, it, expect, afterEach, vi } from 'vitest';
import { GameMode, ItemType, MapId, Team } from '../../types';
import { getPlatforms, getInitialPickups, HTF_FLAG_POS, INTEL_POS } from '../data/level';
import { createRoomState, isTeamMode, spawnPointFor } from '../net/roomSetup';
import { createHungerZone, hungerSpawnPoint } from '../systems/hungerRound';
import { checkRectOverlap } from '../utils/math';
import { COVER_SPECS, Cover } from './coverTypes';
import { getCoverLayout, layoutKeyFor } from './coverLayout';

interface Case { name: string; mode: GameMode; map: MapId; key: string | null; count: number }

// Every mode x map that getPlatforms tells apart. `count` is the object count after the
// spec's "Known fixes" (see docs/plans/2026-11-04-destructible-cover-spec.md, Placement).
const CASES: Case[] = [
    { name: 'Deathmatch default', mode: GameMode.DEATHMATCH, map: MapId.DEFAULT, key: 'dm', count: 13 },
    { name: 'Deathmatch tunnels', mode: GameMode.DEATHMATCH, map: MapId.TUNNELS, key: 'tunnels', count: 17 },
    { name: 'Hunger Games', mode: GameMode.HUNGER_GAMES, map: MapId.HUNGER, key: 'hunger', count: 18 },
    { name: 'Capture the Flag', mode: GameMode.CTF, map: MapId.DEFAULT, key: 'ctf', count: 11 },
    { name: 'Gun Game', mode: GameMode.GUN_GAME, map: MapId.DEFAULT, key: 'ctf', count: 11 },
    { name: 'Hold the Flag', mode: GameMode.HOLD_THE_FLAG, map: MapId.DEFAULT, key: 'htf', count: 9 },
    { name: 'Infiltration', mode: GameMode.INFILTRATION, map: MapId.DEFAULT, key: 'infiltration', count: 13 },
    { name: 'Duel (The Pit)', mode: GameMode.DUEL, map: MapId.PIT, key: null, count: 0 },
];

const rectOf = (c: Cover) => {
    const { w, h } = COVER_SPECS[c.kind];
    return { x: c.pos.x - w / 2, y: c.pos.y - h, w, h };
};

// Same collection rect physics.ts uses for pickups (Item Collection loop): flags are tall, the rest small cubes.
const pickupRect = (item: { type: ItemType; pos: { x: number; y: number } }) => {
    const w = item.type === ItemType.FLAG ? 80 : 40;
    const h = item.type === ItemType.FLAG ? 100 : 40;
    return { x: item.pos.x - w / 2, y: item.pos.y - h, w, h };
};

afterEach(() => { vi.restoreAllMocks(); });

describe('layoutKeyFor', () => {
    it.each(CASES)('$name picks layout $key', ({ mode, map, key }) => {
        expect(layoutKeyFor(mode, map)).toBe(key);
    });

    it('only Deathmatch looks at the map', () => {
        expect(layoutKeyFor(GameMode.CTF, MapId.TUNNELS)).toBe('ctf');
        expect(layoutKeyFor(GameMode.HUNGER_GAMES, MapId.DEFAULT)).toBe('hunger');
        expect(layoutKeyFor(GameMode.DEATHMATCH, MapId.HUNGER)).toBe('dm');
    });
});

describe.each(CASES)('cover layout: $name', ({ mode, map, count }) => {
    const layout = getCoverLayout(mode, map);
    const platforms = getPlatforms(mode, map);
    const pickups = getInitialPickups(mode, map);

    it('has the expected number of objects, all at full HP', () => {
        expect(layout).toHaveLength(count);
        for (const c of layout) expect(c.hp).toBe(COVER_SPECS[c.kind].hp);
    });

    it('every object stands on a platform top', () => {
        for (const c of layout) {
            const r = rectOf(c);
            const base = platforms.find(p => p.y === c.pos.y && r.x >= p.x && r.x + r.w <= p.x + p.w);
            expect(base, `${c.id} (${c.kind} ${c.pos.x},${c.pos.y}) has no platform under it`).toBeDefined();
        }
    });

    it('no object overlaps a platform or another object', () => {
        layout.forEach((c, i) => {
            const r = rectOf(c);
            for (const p of platforms) {
                expect(checkRectOverlap(r, p), `${c.id} overlaps platform ${p.id}`).toBe(false);
            }
            for (const other of layout.slice(i + 1)) {
                expect(checkRectOverlap(r, rectOf(other)), `${c.id} overlaps ${other.id}`).toBe(false);
            }
        });
    });

    it('no object overlaps a pickup', () => {
        for (const c of layout) {
            for (const item of pickups) {
                expect(checkRectOverlap(rectOf(c), pickupRect(item)), `${c.id} overlaps pickup ${item.id}`).toBe(false);
            }
        }
    });

    it('barrels keep 400 px from flags and fixed spawns', () => {
        const barrels = layout.filter(c => c.kind === 'barrel');
        const flagSpots = pickups.filter(p => p.type === ItemType.FLAG || p.type === ItemType.INTEL).map(p => p.pos);
        if (mode === GameMode.HOLD_THE_FLAG) flagSpots.push(HTF_FLAG_POS);
        if (mode === GameMode.INFILTRATION) flagSpots.push(INTEL_POS);

        // Fixed team spawn x-ranges come from the real spawn function: random 0 gives the left end, 1 the right.
        const spawnRanges: { team: Team; min: number; max: number }[] = [];
        if (isTeamMode(mode)) {
            for (const team of [Team.BLUE, Team.RED]) {
                const spy = vi.spyOn(Math, 'random');
                spy.mockReturnValue(0);
                const min = spawnPointFor(mode)(team).x;
                spy.mockReturnValue(1);
                const max = spawnPointFor(mode)(team).x;
                spawnRanges.push({ team, min, max });
            }
            expect(spawnRanges).toHaveLength(2);
        }

        for (const b of barrels) {
            for (const f of flagSpots) {
                expect(Math.hypot(b.pos.x - f.x, b.pos.y - f.y), `${b.id} too close to a flag at ${f.x},${f.y}`).toBeGreaterThanOrEqual(400);
            }
            for (const s of spawnRanges) {
                const dx = Math.max(s.min - b.pos.x, b.pos.x - s.max, 0);
                expect(dx, `${b.id} too close to the ${s.team} spawn`).toBeGreaterThanOrEqual(400);
            }
        }
    });
});

describe('Hunger Games spawn slots', () => {
    // Every deterministic spawn spot, read from the real spawn code: a new round hands out each
    // slot once before it repeats one, so plenty of calls list them all.
    const spawnSpots = () => {
        createHungerZone(Date.now());
        const seen = new Map<string, { x: number; y: number }>();
        for (let i = 0; i < 500; i++) {
            const s = hungerSpawnPoint();
            seen.set(`${s.x},${s.y}`, s);
        }
        createHungerZone(Date.now()); // leave the round state fresh for other tests
        return [...seen.values()];
    };

    it('no cover on a Hunger spawn slot', () => {
        const spots = spawnSpots();
        expect(spots.length).toBeGreaterThan(0);
        const layout = getCoverLayout(GameMode.HUNGER_GAMES, MapId.HUNGER);
        const onSlot: string[] = [];
        for (const spot of spots) {
            // Fighter hitbox as in physics.ts: 30 wide, 72 tall, pos = (centreX, feet)
            const fighter = { x: spot.x - 15, y: spot.y - 72, w: 30, h: 72 };
            for (const c of layout) {
                if (checkRectOverlap(fighter, rectOf(c))) onSlot.push(`${c.id} (${c.kind} ${c.pos.x},${c.pos.y}) on slot ${spot.x},${spot.y}`);
            }
        }
        expect(onSlot).toEqual([]);
    });
});

describe('getCoverLayout', () => {
    it('duel has no cover', () => {
        expect(getCoverLayout(GameMode.DUEL, MapId.PIT)).toEqual([]);
    });

    it('ids are unique and stable between calls', () => {
        for (const { mode, map, key } of CASES) {
            const ids = getCoverLayout(mode, map).map(c => c.id);
            expect(new Set(ids).size).toBe(ids.length);
            expect(getCoverLayout(mode, map).map(c => c.id)).toEqual(ids);
            ids.forEach((id, i) => expect(id).toBe(`cover_${key}_${i}`));
        }
    });

    it('hands out fresh objects every call', () => {
        const first = getCoverLayout(GameMode.CTF, MapId.DEFAULT);
        first[0].hp = 1;
        first[0].pos.x = 99999;
        const second = getCoverLayout(GameMode.CTF, MapId.DEFAULT);
        expect(second[0].hp).toBe(COVER_SPECS[second[0].kind].hp);
        expect(second[0].pos.x).not.toBe(99999);
    });

    it('createRoomState carries the layout in state.cover', () => {
        const state = createRoomState(GameMode.DEATHMATCH, MapId.TUNNELS);
        expect(state.cover).toEqual(getCoverLayout(GameMode.DEATHMATCH, MapId.TUNNELS));
        expect(createRoomState(GameMode.DUEL, MapId.PIT).cover).toEqual([]);
    });
});
