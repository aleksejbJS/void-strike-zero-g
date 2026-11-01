import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameMode, Team } from '../../types';
import { HUNGER_MIN_ZONE, HUNGER_QUIET_SHRINK, HUNGER_SHRINK_DELAY, HUNGER_SHRINK_STEP } from '../../constants';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { createHungerZone, hungerSpawnPoint, hungerShieldLeft, HUNGER_SHIELD_MS, insideZone } from './hungerRound';
import { scheduleHungerZoneShrink, tickHungerZoneShrink } from './gamemodes';
import { applyDamage } from './combat';
import { getPlatforms } from '../data/level';

const hungerState = (now = 0) => {
    const state = createMockState(GameMode.HUNGER_GAMES);
    state.hungerZone = createHungerZone(now);
    state.hungerRoundStartedAt = now;
    return state;
};

afterEach(() => { vi.useRealTimers(); });

describe('Hunger Games zone', () => {
    it('closes in from the sides and the top, keeping its bottom on the arena floor', () => {
        const state = hungerState();
        const zone = state.hungerZone!;
        const bottom = zone.y + zone.h, centerX = zone.x + zone.w / 2, w = zone.w, h = zone.h;
        scheduleHungerZoneShrink(state, 0);
        tickHungerZoneShrink(state, HUNGER_SHRINK_DELAY);
        expect(zone.y + zone.h).toBe(bottom);
        expect(zone.x + zone.w / 2).toBe(centerX);
        expect(zone.w).toBe(w - HUNGER_SHRINK_STEP * 2);
        expect(zone.h).toBe(h - HUNGER_SHRINK_STEP);
    });

    it('stays put at its smallest size instead of drifting', () => {
        const state = hungerState();
        const zone = state.hungerZone!;
        const bottom = zone.y + zone.h, centerX = zone.x + zone.w / 2;
        for (let i = 0; i < 40; i++) {
            scheduleHungerZoneShrink(state, i * 10_000);
            tickHungerZoneShrink(state, i * 10_000 + HUNGER_SHRINK_DELAY);
        }
        expect(zone.w).toBe(HUNGER_MIN_ZONE);
        expect(zone.h).toBe(HUNGER_MIN_ZONE);
        expect(zone.y + zone.h).toBe(bottom);
        expect(zone.x + zone.w / 2).toBe(centerX);
    });

    it('shrinks on its own when nobody dies for a while, with the usual warning', () => {
        const state = hungerState();
        const w = state.hungerZone!.w;
        tickHungerZoneShrink(state, HUNGER_QUIET_SHRINK - HUNGER_SHRINK_DELAY - 1);
        expect(state.hungerZone!.pendingShrink).toBeFalsy();
        tickHungerZoneShrink(state, HUNGER_QUIET_SHRINK - HUNGER_SHRINK_DELAY);
        expect(state.hungerZone!.pendingShrink).toBe(true);
        tickHungerZoneShrink(state, HUNGER_QUIET_SHRINK);
        expect(state.hungerZone!.w).toBeLessThan(w);
    });
});

describe('Hunger Games round start', () => {
    it('spreads the fighters over platform tops, far apart', () => {
        createHungerZone(0);
        const spots = Array.from({ length: 8 }, () => hungerSpawnPoint());
        const tops = new Set(getPlatforms(GameMode.HUNGER_GAMES).map(p => p.y - 2));
        spots.forEach(s => expect(tops.has(s.y)).toBe(true));
        for (let i = 0; i < spots.length; i++) {
            for (let j = i + 1; j < spots.length; j++) {
                expect(Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y)).toBeGreaterThanOrEqual(700);
            }
        }
        const zone = createHungerZone(0);
        spots.forEach(s => expect(insideZone({ mode: GameMode.HUNGER_GAMES, hungerZone: zone }, s)).toBe(true));
    });

    it('protects everyone for the first seconds, but falling out of the map still kills', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(10_000);
        const state = hungerState(10_000);
        const target = createMockPlayer('t', Team.NONE);
        const fallen = createMockPlayer('f', Team.NONE);
        state.players.push(target, fallen);
        expect(hungerShieldLeft(state, 10_000)).toBe(HUNGER_SHIELD_MS);

        applyDamage(state, target, 'someone', 50, { x: 0, y: 0 });
        expect(target.health).toBe(100);
        applyDamage(state, fallen, '', 9999, { x: 0, y: 0 });
        expect(fallen.dead).toBe(true);

        vi.setSystemTime(10_000 + HUNGER_SHIELD_MS);
        applyDamage(state, target, 'someone', 50, { x: 0, y: 0 });
        expect(target.health).toBe(50);
    });
});
