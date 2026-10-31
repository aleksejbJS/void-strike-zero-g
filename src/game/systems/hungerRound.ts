// Hunger Games round lifecycle, shared by offline play and the authoritative room:
// last one standing wins (or the best survivor when time runs out),
// then a new round starts after HUNGER_RESTART_DELAY.

import { Entity, GameState } from '../../types';

export const HUNGER_RESTART_DELAY = 10000;
// Bots don't hunt each other, so without a limit a round of bots can last forever
export const HUNGER_ROUND_TIME = 5 * 60 * 1000;
export const HUNGER_ROUND_SIZE = 8; // fighters per round (humans + bots)

const START_ZONE = { x: -2600, y: -1600, w: 8200, h: 3600 };

export const hungerSpawnPoint = () => ({
    x: -2400 + Math.random() * 4800,
    y: Math.random() > 0.5 ? 1200 + Math.random() * 300 : 200 + Math.random() * 800,
});

export const createHungerZone = (now: number): NonNullable<GameState['hungerZone']> => ({ ...START_ZONE, lastShrink: now });

/** Time's up: most kills wins, remaining health breaks a tie. */
const bestSurvivor = (alive: Entity[]) =>
    alive.reduce<Entity | undefined>((best, p) =>
        !best || p.score > best.score || (p.score === best.score && p.health > best.health) ? p : best, undefined);

/**
 * End the round once at most one fighter is alive (a simultaneous double kill
 * ends it with no winner instead of hanging forever), or when the round time
 * runs out. Called every tick.
 */
export const updateHungerRound = (state: GameState, now: number) => {
    if (state.hungerRoundEndsAt) return;
    const alive = state.players.filter(p => !p.dead);

    if (alive.length <= 1) {
        state.hungerWinnerId = alive[0]?.id ?? null;
        state.hungerEndReason = 'last-standing';
    } else if (state.hungerRoundStartedAt !== undefined && now - state.hungerRoundStartedAt >= HUNGER_ROUND_TIME) {
        state.hungerWinnerId = bestSurvivor(alive)?.id ?? null;
        state.hungerEndReason = 'time';
    } else {
        return;
    }
    state.hungerRoundEndsAt = now + HUNGER_RESTART_DELAY;
};

/** Milliseconds left in a running round, or null if it has no clock or already ended. */
export const hungerTimeLeft = (state: GameState, now: number): number | null =>
    state.hungerRoundStartedAt === undefined || state.hungerRoundEndsAt
        ? null
        : Math.max(0, state.hungerRoundStartedAt + HUNGER_ROUND_TIME - now);

export const isHungerRoundOver = (state: GameState, now: number) =>
    !!state.hungerRoundEndsAt && now >= state.hungerRoundEndsAt;
