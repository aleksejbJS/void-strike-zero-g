// A tournament guest that lost its link to the host keeps trying to get back into the duel for up to 60 s
// (the spec's disconnect timeout): one attempt at a time, a few seconds apart. The duel's flow keeps
// heartbeating meanwhile, so the guest is not counted as gone while it retries; after 60 s it gives up.

export const REJOIN_WINDOW_MS = 60_000;
export const ATTEMPT_MS = 15_000; // a PeerJS connect takes ~10 s, sometimes far more: an attempt gets this long
export const RETRY_GAP_MS = 3_000; // after a failed attempt, the next one starts this much later

export type RejoinTick = 'idle' | 'trying' | 'gave-up';

export class GuestRejoin {
    private since: number | null = null;
    private attemptAt = 0;
    private failedAt: number | null = null;

    /** `dial`: drop the current link and connect to the host again. */
    constructor(private readonly dial: () => void) {}

    get active(): boolean {
        return this.since !== null;
    }

    start(now: number): void {
        if (this.since !== null) return;
        this.since = now;
        this.attempt(now);
    }

    /** The room accepted us again. */
    done(): void {
        this.since = null;
        this.failedAt = null;
    }

    /** The current attempt failed (link closed, connect error, rejected). */
    failed(now: number): void {
        if (this.since !== null) this.failedAt ??= now;
    }

    tick(now: number): RejoinTick {
        if (this.since === null) return 'idle';
        if (now - this.since >= REJOIN_WINDOW_MS) {
            this.done();
            return 'gave-up';
        }
        const due = this.failedAt !== null ? now - this.failedAt >= RETRY_GAP_MS : now - this.attemptAt >= ATTEMPT_MS;
        if (due) this.attempt(now);
        return 'trying';
    }

    private attempt(now: number): void {
        this.attemptAt = now;
        this.failedAt = null;
        this.dial();
    }
}
