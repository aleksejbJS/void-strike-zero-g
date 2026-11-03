// Per-bot memory kept between ticks: current goal, chosen target and progress tracking.

import { Entity, Vector2 } from '../../types';
import { distance } from '../utils/math';
import { BotMoves, BotNav, newBotMoves, newBotNav } from './botNavState';

export type BotState = 'hunt' | 'defend' | 'retreat' | 'flag-run' | 'roam';

export interface BotMemory {
    state: BotState;
    targetId: string | null;
    targetVisible: boolean; // as of the last look around
    nextScanAt: number;     // when the bot looks around for a target again
    progressCheckAt: number;
    progressPos: Vector2;   // position at the previous progress check
    unstickUntil: number;   // jetpack out of a stuck spot until this time
    fireAllowedAt: number;  // reaction time: no shots at a freshly spotted target before this
    nav: BotNav;            // route on the navigation graph
    moves: BotMoves;        // strafe, dodge and escape timing
    lastSeen: Map<string, Vector2>; // where each fighter was last seen out of smoke
}

// Progress is judged over a time window, not per tick: at 120 ticks/s a running
// bot moves only ~2 px per tick, which looks like standing still tick by tick.
export const BOT_PROGRESS_CHECK_MS = 500;
export const BOT_MIN_PROGRESS = 15; // px per window while trying to move
export const BOT_UNSTICK_MS = 400;

// How long a bot takes to open fire on a target it has just spotted (a human takes about as long)
const REACTION_MIN_MS = 400;
const REACTION_MAX_MS = 900;
export const reactionDelay = () => REACTION_MIN_MS + Math.random() * (REACTION_MAX_MS - REACTION_MIN_MS);

const botMemory = new Map<string, BotMemory>();

export const clearBotMemory = () => botMemory.clear();

/** A bot's memory if it has one, without creating it (debug overlay). */
export const peekBotMemory = (id: string): BotMemory | undefined => botMemory.get(id);

export const getBotMemory = (bot: Entity): BotMemory => {
    let mem = botMemory.get(bot.id);
    if (!mem) {
        mem = {
            state: 'roam',
            targetId: null,
            targetVisible: false,
            nextScanAt: 0,
            progressCheckAt: 0,
            progressPos: { ...bot.pos },
            unstickUntil: 0,
            fireAllowedAt: 0,
            nav: newBotNav(),
            moves: newBotMoves(bot.health),
            lastSeen: new Map(),
        };
        botMemory.set(bot.id, mem);
    }
    return mem;
};

/** True once per window in which the bot tried to move but barely did. */
export const detectStuck = (mem: BotMemory, bot: Entity, wantsToMove: boolean, now: number): boolean => {
    if (now < mem.progressCheckAt) return false;
    const firstCheck = mem.progressCheckAt === 0;
    const moved = distance(bot.pos, mem.progressPos);
    mem.progressCheckAt = now + BOT_PROGRESS_CHECK_MS;
    mem.progressPos = { ...bot.pos };
    return !firstCheck && wantsToMove && moved < BOT_MIN_PROGRESS;
};
