import { describe, it, expect } from 'vitest';
import { GameMode, MapId, Team } from '../../types';
import { createBots, createRoomState, resetMatch } from './roomSetup';
import { spawnSmoke } from '../systems/smoke';

describe('createBots looks', () => {
    it.each([GameMode.DEATHMATCH, GameMode.GUN_GAME, GameMode.HUNGER_GAMES])(
        '%s bots each wear their own skin and build', mode => {
            const bots = createBots(mode);
            expect(new Set(bots.map(b => b.skinId)).size).toBe(bots.length);
            for (const bot of bots) expect(bot.build).toBeDefined();
        });

    it.each([GameMode.CTF, GameMode.HOLD_THE_FLAG, GameMode.INFILTRATION])(
        '%s bots keep their team colour', mode => {
            for (const bot of createBots(mode)) {
                expect(bot.torsoColor).toBe(bot.team === Team.RED ? '#ef4444' : '#3b82f6');
                expect(bot.skinId).toBe('classic');
                expect(bot.build).toBeUndefined();
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
