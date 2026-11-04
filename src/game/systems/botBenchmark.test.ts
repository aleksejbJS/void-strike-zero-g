// @vitest-environment node
// How well bots play, measured in bots-only matches (targets from the bot navigation spec).

import { describe, it, expect } from 'vitest';
import { runBotMatch } from '../../test/botBench';
import { GameMode, MapId } from '../../types';
import { clearBotMemory } from './bot';

const STILL_LIMIT_MS = 10_000;
// A 3-bot minute averages ~8 kills; single seeds swing from 4 to 11 (measured over seeds 1-20
// after the 2 s spawn shield landed, which cost about 5% of kills). Below this, bots are passive.
const DM_MIN_KILLS = 4;

describe('bot benchmark', () => {
    it.each([1, 2, 3, 4, 5])(`Deathmatch, 3 bots, 60 s, seed %i: at least ${DM_MIN_KILLS} kills, nobody camps`, seed => {
        clearBotMemory();
        const r = runBotMatch(GameMode.DEATHMATCH, MapId.DEFAULT, 60, seed);
        console.log(`DM seed ${seed}: ${r.kills} kills, longest still ${(r.longestStillMs / 1000).toFixed(1)} s (${r.stillBot})`);
        expect(r.kills).toBeGreaterThanOrEqual(DM_MIN_KILLS);
        expect(r.longestStillMs).toBeLessThan(STILL_LIMIT_MS);
    }, 60_000);

    // Captures are rare (about 1 in 6 such runs): defenders respawn on their own flag 3 s after
    // dying, so carriers seldom make it home. What the bots control is getting to the flag.
    it('CTF, 6 bots, 3 min: bots reach and take the enemy flag', () => {
        clearBotMemory();
        const r = runBotMatch(GameMode.CTF, MapId.DEFAULT, 180, 7);
        console.log(`CTF: ${r.flagPickups} flag pickups, ${r.captures} captures, ${r.kills} kills, longest still ${(r.longestStillMs / 1000).toFixed(1)} s (${r.stillBot})`);
        expect(r.flagPickups).toBeGreaterThanOrEqual(1);
        expect(r.longestStillMs).toBeLessThan(STILL_LIMIT_MS);
    }, 120_000);

    it.each([
        ['Tunnels', GameMode.DEATHMATCH, MapId.TUNNELS],
        ['Hunger Games', GameMode.HUNGER_GAMES, MapId.HUNGER],
    ])('%s, 60 s: bots fight and nobody camps', (_name, mode, map) => {
        clearBotMemory();
        const r = runBotMatch(mode as GameMode, map as MapId, 60, 11);
        console.log(`${_name}: ${r.kills} kills, longest still ${(r.longestStillMs / 1000).toFixed(1)} s (${r.stillBot})`);
        expect(r.kills).toBeGreaterThanOrEqual(3);
        expect(r.longestStillMs).toBeLessThan(STILL_LIMIT_MS);
    }, 60_000);
});
