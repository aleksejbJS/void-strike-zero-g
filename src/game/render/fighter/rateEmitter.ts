// Spawning by elapsed time instead of per frame: a 60, 120 or 144 Hz display spawns the same number of
// particles per second, and the fraction left over from one frame carries into the next.

/** A frame after a pause (or the first one) counts as at most this long, so it never dumps a burst. */
const MAX_GAP_MS = 1000 / 30;

export class RateEmitter {
    private last = Number.NaN;
    private carry = 0;

    /** How many to spawn at `now` for `perSecond`; the first call, a call after a pause or a clock that went back counts as one short frame. */
    take(now: number, perSecond: number): number {
        const gap = Number.isFinite(this.last) && now >= this.last ? Math.min(now - this.last, MAX_GAP_MS) : MAX_GAP_MS;
        this.last = now;
        this.carry += (gap * perSecond) / 1000;
        const n = Math.floor(this.carry);
        this.carry -= n;
        return n;
    }
}
