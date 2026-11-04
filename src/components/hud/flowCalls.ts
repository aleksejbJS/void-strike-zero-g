// The tournament API calls of one duel: a failure is shown (and, when asked, tried again a few seconds later)
// while the duel is open; after dispose() a late answer is only logged and nothing is retried.

const RETRY_MS = 5_000;

export interface FlowCallHooks {
    /** A call failed: log it and show it. */
    fail: (what: string, error: unknown) => void;
    /** A call went through: the shown error, if any, is over. */
    ok: () => void;
}

export class FlowCalls {
    private closed = false;
    private readonly timers = new Set<ReturnType<typeof setTimeout>>();

    constructor(private readonly hooks: FlowCallHooks) {}

    get disposed(): boolean {
        return this.closed;
    }

    /** Runs one API call; a failure is shown and, with `retry`, tried again in a few seconds. */
    run(what: string, request: () => Promise<void>, retry?: () => void): void {
        request().then(
            () => { if (!this.closed) this.hooks.ok(); },
            (error: unknown) => {
                if (this.closed) {
                    console.warn(`[tournament] ${what} failed after the duel closed`, error);
                    return;
                }
                this.hooks.fail(what, error);
                if (!retry) return;
                const timer = setTimeout(() => { this.timers.delete(timer); retry(); }, RETRY_MS);
                this.timers.add(timer);
            },
        );
    }

    dispose(): void {
        this.closed = true;
        this.timers.forEach(clearTimeout);
        this.timers.clear();
    }
}
