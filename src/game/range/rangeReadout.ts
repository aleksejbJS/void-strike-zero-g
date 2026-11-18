// The damage log of the test range (#range). Every step it compares each target's value with the step before
// (dummy: health + armour, cover: hp) and logs the drops, so the "last 3 s" total also holds damage the game never
// shows as a number (burning, bleeding after a railgun wound) and needs no change in the shared damage code.
// Run once per fixed step right AFTER updatePhysics. The memory lives as long as one range session.

import type { GameState } from '../../types';
import { COVER_SPECS } from '../cover/coverTypes';
import { emitText } from '../systems/effects';

/** How long a hit stays in the "last 3 s" total. */
export const READOUT_WINDOW_MS = 3000;

const COVER_TEXT_COLOR = '#facc15';
const COVER_TEXT_GAP = 10; // px between the top of a piece and its damage number

export interface ReadoutMemory {
    /** Target id -> its value at the previous step. */
    last: Record<string, number>;
    /** Target id -> the drops of the last 3 s, oldest first. */
    hits: Record<string, { at: number; amount: number }[]>;
}

export const createReadoutMemory = (): ReadoutMemory => ({ last: {}, hits: {} });

/** Stores `value` as the latest for `id`; a drop since the previous step is logged and returned, anything else is 0. */
const observe = (memory: ReadoutMemory, id: string, value: number, now: number): number => {
    const before = memory.last[id];
    memory.last[id] = value;
    if (before === undefined || value >= before) return 0; // first sight, or a rise: revive, reset, return, armour given
    const drop = before - value;
    (memory.hits[id] ??= []).push({ at: now, amount: drop });
    return drop;
};

const isRecent = (at: number, now: number): boolean => now - at <= READOUT_WINDOW_MS;

const dropOldHits = (memory: ReadoutMemory, now: number): void => {
    for (const id of Object.keys(memory.hits)) {
        const recent = memory.hits[id].filter(hit => isRecent(hit.at, now));
        if (recent.length > 0) memory.hits[id] = recent;
        else delete memory.hits[id];
    }
};

/**
 * Logs what every dummy and piece of cover lost since the last call. A fighter's hit already shows the game's own
 * number, so only cover gets one here: the drop, in yellow, just above the piece.
 */
export const trackRangeDamage = (memory: ReadoutMemory, state: GameState, now: number): void => {
    for (const p of state.players) {
        if (p.dummy) observe(memory, p.id, p.health + p.armor, now);
    }
    for (const cover of state.cover ?? []) {
        const drop = observe(memory, cover.id, cover.hp, now);
        if (drop > 0) {
            const y = cover.pos.y - COVER_SPECS[cover.kind].h - COVER_TEXT_GAP; // pos is the bottom edge
            emitText(cover.pos.x, y, String(Math.round(drop)), COVER_TEXT_COLOR);
        }
    }
    dropOldHits(memory, now);
};

/** What the target `id` lost in the last 3 s, rounded. Reads only: the log is trimmed by trackRangeDamage. */
export const recentDamage = (memory: ReadoutMemory, id: string, now: number): number => {
    let sum = 0;
    for (const hit of memory.hits[id] ?? []) {
        if (isRecent(hit.at, now)) sum += hit.amount;
    }
    return Math.round(sum);
};
