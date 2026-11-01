// Hunger Games round lifecycle, shared by offline play and the authoritative room:
// last one standing wins (or the best survivor when time runs out),
// then a new round starts after HUNGER_RESTART_DELAY.

import { Entity, GameMode, GameState, Vector2 } from '../../types';
import { getPlatforms } from '../data/level';

export const HUNGER_RESTART_DELAY = 10000;
// Bots don't hunt each other, so without a limit a round of bots can last forever
export const HUNGER_ROUND_TIME = 5 * 60 * 1000;
export const HUNGER_ROUND_SIZE = 8; // fighters per round (humans + bots)
// Nobody takes damage this long after a round starts (players get to look around)
export const HUNGER_SHIELD_MS = 3000;

const START_ZONE = { x: -2600, y: -1600, w: 8200, h: 3600 };
const SPAWN_GAP = 700;          // fighters of one round start at least this far apart
const FLOOR_SLOT_STEP = 1100;   // spawn spots along the long arena floor

// Spawn spots: the top of every platform, plus spots along the floor, all inside the start zone
const SPAWN_SLOTS: Vector2[] = getPlatforms(GameMode.HUNGER_GAMES)
    .filter(p => p.h <= 600 && p.y > START_ZONE.y) // skip outer walls and the ceiling
    .flatMap(p => {
        if (p.w <= 2000) return [{ x: p.x + p.w / 2, y: p.y }];
        const xs: number[] = [];
        for (let x = START_ZONE.x + 400; x < START_ZONE.x + START_ZONE.w - 400; x += FLOOR_SLOT_STEP) xs.push(x);
        return xs.map(x => ({ x, y: p.y }));
    });

let takenThisRound: Vector2[] = [];

const shuffled = <T>(list: T[]) => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
};

/** A spot on top of a platform, as far as possible from where others already started this round. */
export const hungerSpawnPoint = (): Vector2 => {
    const free = shuffled(SPAWN_SLOTS.filter(s => !takenThisRound.includes(s)));
    const spot = free.find(s => takenThisRound.every(t => Math.hypot(s.x - t.x, s.y - t.y) >= SPAWN_GAP))
        ?? free[0]
        ?? SPAWN_SLOTS[Math.floor(Math.random() * SPAWN_SLOTS.length)];
    takenThisRound.push(spot);
    return { x: spot.x, y: spot.y - 2 }; // feet just above the surface
};

/** New round: fresh zone and fresh spawn spots. Create the zone before spawning the fighters. */
export const createHungerZone = (now: number): NonNullable<GameState['hungerZone']> => {
    takenThisRound = [];
    return { ...START_ZONE, lastShrink: now };
};

/** Hunger Games: anything outside the zone is out of reach (the zone pushes fighters back). */
export const insideZone = (state: Pick<GameState, 'mode' | 'hungerZone'>, pos: Vector2) => {
    const hz = state.mode === GameMode.HUNGER_GAMES ? state.hungerZone : undefined;
    return !hz || (pos.x > hz.x && pos.x < hz.x + hz.w && pos.y > hz.y && pos.y < hz.y + hz.h);
};

/** Milliseconds of start-of-round protection left (0 when it is over or outside Hunger Games). */
export const hungerShieldLeft = (state: Pick<GameState, 'mode' | 'hungerRoundStartedAt'>, now: number) =>
    state.mode === GameMode.HUNGER_GAMES && state.hungerRoundStartedAt !== undefined
        ? Math.max(0, state.hungerRoundStartedAt + HUNGER_SHIELD_MS - now)
        : 0;

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
