import { describe, it, expect } from 'vitest';
import { GameMode, MapId, Team } from '../../types';
import { createBots, createRoomState, resetHungerRound, resetMatch } from './roomSetup';
import { spawnSmoke } from '../systems/smoke';
import { duelSpawnByIndex } from '../systems/duelRules';
import { createMockPlayer } from '../../test/mocks';
import { damageCover } from '../cover/coverDamage';
import { isIntact } from '../cover/coverGeometry';
import { COVER_SPECS, Cover } from '../cover/coverTypes';
import { BODY_PRESETS } from '../build/characterBases';

describe('createBots looks', () => {
    it.each([GameMode.DEATHMATCH, GameMode.GUN_GAME, GameMode.HUNGER_GAMES])(
        '%s bots each wear their own skin and build', mode => {
            const bots = createBots(mode);
            expect(new Set(bots.map(b => b.skinId)).size).toBe(Math.min(bots.length, BODY_PRESETS.length));
            for (const bot of bots) expect(bot.build).toBeDefined();
        });

    it.each([GameMode.CTF, GameMode.HOLD_THE_FLAG, GameMode.INFILTRATION])(
        '%s bots keep their team colour', mode => {
            const bots = createBots(mode);
            expect(new Set(bots.map(bot => bot.skinId)).size).toBe(Math.min(bots.length, BODY_PRESETS.length));
            for (const bot of bots) {
                expect(bot.torsoColor).toBe(bot.team === Team.RED ? '#ef4444' : '#3b82f6');
                expect(bot.jetpackColor).toBe(bot.torsoColor);
                const preset = BODY_PRESETS.find(candidate => candidate.id === bot.skinId);
                expect(preset).toBeDefined();
                expect(bot.build).toMatchObject({ body: preset!.body, helmet: 'none', visor: 'none' });
                expect(bot.headColor).toBe(preset!.palette.head);
                expect(bot.armColor).toBe(preset!.palette.arms);
            }
        });
});

describe('resetMatch', () => {
    it('clears smoke clouds along with shots and beams', () => {
        const state = createRoomState(GameMode.DEATHMATCH, MapId.DEFAULT);
        expect(state.smokes).toEqual([]);
        spawnSmoke(state, { x: 0, y: 0 }, Date.now());

        resetMatch(state);

        expect(state.smokes).toEqual([]);
    });
});

describe('resets and cover', () => {
    const NOW = 1_000_000;
    type Room = ReturnType<typeof createRoomState>;
    const resets: [GameMode, (s: Room) => void][] = [
        [GameMode.DEATHMATCH, s => resetMatch(s)],
        [GameMode.HUNGER_GAMES, s => resetHungerRound(s, NOW)],
    ];

    it.each(resets)('%s reset brings back every broken piece', (mode, reset) => {
        const state = createRoomState(mode, MapId.DEFAULT);
        expect(state.cover?.length).toBeGreaterThan(0);
        for (const c of state.cover ?? []) damageCover(state, c, 10_000, 'p1', NOW);
        expect(state.cover?.some(isIntact)).toBe(false);

        reset(state);

        for (const c of state.cover ?? []) {
            expect(c.hp).toBe(COVER_SPECS[c.kind].hp);
            expect(c.returnsAt).toBeUndefined();
        }
    });

    it('a reset with a crate on a spawn point lifts the fighter', () => {
        const state = createRoomState(GameMode.DUEL, MapId.DEFAULT);
        const spawn = duelSpawnByIndex(0);
        const crate: Cover = { id: 'c', kind: 'wood', pos: { ...spawn }, hp: 0, returnsAt: NOW }; // broken now, whole after the reset
        state.cover = [crate];
        state.players.push(createMockPlayer('p1', Team.NONE));

        resetMatch(state);

        expect(isIntact(crate)).toBe(true);
        expect(state.players[0].pos).toEqual({ x: spawn.x, y: spawn.y - COVER_SPECS.wood.h });
    });
});
