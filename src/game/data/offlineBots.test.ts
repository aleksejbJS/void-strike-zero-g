import { describe, it, expect } from 'vitest';
import { GameMode } from '../../types';
import { HUNGER_ROUND_SIZE } from '../systems/hungerRound';
import { offlineBotCount } from './offlineBots';

describe('offlineBotCount', () => {
    it('gives the test range no bots: it has its dummies instead', () => {
        expect(offlineBotCount(GameMode.RANGE)).toBe(0);
    });

    it('keeps the old counts of every other offline mode', () => {
        expect(offlineBotCount(GameMode.DEATHMATCH)).toBe(3);
        expect(offlineBotCount(GameMode.GUN_GAME)).toBe(3);
        expect(offlineBotCount(GameMode.CTF)).toBe(6);
        expect(offlineBotCount(GameMode.HOLD_THE_FLAG)).toBe(6);
        expect(offlineBotCount(GameMode.INFILTRATION)).toBe(6);
        expect(offlineBotCount(GameMode.HUNGER_GAMES)).toBe(HUNGER_ROUND_SIZE - 1);
    });
});
