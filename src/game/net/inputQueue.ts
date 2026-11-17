// Per-player input buffer on the authoritative side.
// Clients send one input per simulation tick; the room consumes one per tick.

import { PlayerInput } from '../../types';
import { PHYSICS_TICK_RATE } from '../../constants';

// Bound the backlog (~100ms) so a lagging client can't build up latency or memory
const MAX_QUEUED = Math.ceil(PHYSICS_TICK_RATE / 10);
// Every queued input is one tick (8.3 ms) of input lag. Jitter makes the queue swing, so we
// watch its smallest size over a window: if even that stays above the target, the backlog is
// standing (the client's clock runs a bit ahead of ours) and one input is skipped.
const TARGET_BACKLOG = 2;
const BACKLOG_WINDOW_TICKS = Math.round(PHYSICS_TICK_RATE / 4);

/** Same buttons and weapon: skipping one of two such inputs only shifts timing by a tick. */
const sameButtons = (a: PlayerInput, b: PlayerInput) => {
    if (a.mousePressed !== b.mousePressed || a.hookPressed !== b.hookPressed || a.weaponIndex !== b.weaponIndex) return false;
    const aKeys = Object.keys(a.keys).filter(k => a.keys[k]);
    const bKeys = Object.keys(b.keys).filter(k => b.keys[k]);
    return aKeys.length === bKeys.length && aKeys.every(k => b.keys[k]);
};
// Accept at most twice the tick rate per second (allows bursts after a network hiccup)
const MAX_INPUTS_PER_SECOND = PHYSICS_TICK_RATE * 2;

export class InputQueue {
    private queue: PlayerInput[] = [];
    private last: PlayerInput | null = null;
    private lastSequence = -1;
    private windowStart = 0;
    private windowCount = 0;
    private backlogTicks = 0;
    private backlogMin = Infinity;

    /** Inputs waiting for a tick. */
    get length() {
        return this.queue.length;
    }

    /** Returns false if the input was dropped (old, duplicate or over the rate limit). */
    push(input: PlayerInput): boolean {
        if (input.sequence <= this.lastSequence) return false;

        if (input.timestamp - this.windowStart >= 1000) {
            this.windowStart = input.timestamp;
            this.windowCount = 0;
        }
        if (++this.windowCount > MAX_INPUTS_PER_SECOND) return false;

        this.lastSequence = input.sequence;
        this.queue.push(input);
        if (this.queue.length > MAX_QUEUED) this.skipOne();
        return true;
    }

    /** Next input for this tick. Repeats the previous one if nothing new arrived (keys are held). */
    next(): PlayerInput | null {
        this.trimStandingBacklog();
        const input = this.queue.shift();
        if (input) this.last = input;
        return this.last;
    }

    private trimStandingBacklog() {
        this.backlogMin = Math.min(this.backlogMin, this.queue.length);
        if (++this.backlogTicks < BACKLOG_WINDOW_TICKS) return;
        if (this.backlogMin > TARGET_BACKLOG) this.skipOne();
        this.backlogTicks = 0;
        this.backlogMin = Infinity;
    }

    /** Drop one queued input, preferring one that repeats the next (a button change must get through). */
    private skipOne() {
        const redundant = this.queue.findIndex((input, i) => i + 1 < this.queue.length && sameButtons(input, this.queue[i + 1]));
        this.queue.splice(redundant >= 0 ? redundant : 0, 1);
    }
}
