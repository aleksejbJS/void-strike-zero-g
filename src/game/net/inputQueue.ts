// Per-player input buffer on the authoritative side.
// Clients send one input per simulation tick; the room consumes one per tick.

import { PlayerInput } from '../../types';
import { PHYSICS_TICK_RATE } from '../../constants';

// Bound the backlog (~100ms) so a lagging client can't build up latency or memory
const MAX_QUEUED = Math.ceil(PHYSICS_TICK_RATE / 10);
// Accept at most twice the tick rate per second (allows bursts after a network hiccup)
const MAX_INPUTS_PER_SECOND = PHYSICS_TICK_RATE * 2;

export class InputQueue {
    private queue: PlayerInput[] = [];
    private last: PlayerInput | null = null;
    private lastSequence = -1;
    private windowStart = 0;
    private windowCount = 0;

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
        if (this.queue.length > MAX_QUEUED) this.queue.shift();
        return true;
    }

    /** Next input for this tick. Repeats the previous one if nothing new arrived (keys are held). */
    next(): PlayerInput | null {
        const input = this.queue.shift();
        if (input) this.last = input;
        return this.last;
    }
}
