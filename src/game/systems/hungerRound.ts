// Hunger Games round lifecycle, shared by offline play and the authoritative room:
// last one standing wins, then a new round starts after HUNGER_RESTART_DELAY.

import { GameState } from '../../types';

export const HUNGER_RESTART_DELAY = 10000;
export const HUNGER_ROUND_SIZE = 8; // fighters per round (humans + bots)

const START_ZONE = { x: -2600, y: -1600, w: 8200, h: 3600 };

export const hungerSpawnPoint = () => ({
    x: -2400 + Math.random() * 4800,
    y: Math.random() > 0.5 ? 1200 + Math.random() * 300 : 200 + Math.random() * 800,
});

export const createHungerZone = (now: number): NonNullable<GameState['hungerZone']> => ({ ...START_ZONE, lastShrink: now });

/**
 * End the round once at most one fighter is alive (a simultaneous double kill
 * ends it with no winner instead of hanging forever). Called every tick.
 */
export const updateHungerRound = (state: GameState, now: number) => {
    if (state.hungerRoundEndsAt) return;
    const alive = state.players.filter(p => !p.dead);
    if (alive.length > 1) return;
    state.hungerWinnerId = alive[0]?.id ?? null;
    state.hungerRoundEndsAt = now + HUNGER_RESTART_DELAY;
};

export const isHungerRoundOver = (state: GameState, now: number) =>
    !!state.hungerRoundEndsAt && now >= state.hungerRoundEndsAt;
