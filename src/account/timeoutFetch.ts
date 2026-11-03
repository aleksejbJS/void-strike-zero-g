// A fetch for the Supabase client that gives up after a while, so no account request can hang forever
// (the account windows wait for their call). The caller's own abort signal still works.

export const REQUEST_TIMEOUT_MS = 15_000;

type Fetch = typeof fetch;

/** Late-bound, so a fetch replaced after start-up (tests, polyfills) is the one used. */
const globalFetch: Fetch = (input, init) => fetch(input, init);

/**
 * Wraps `base` so each request is aborted after `timeoutMs`. The abort is an "AbortError" whose message
 * says it timed out: supabase-js does not retry an aborted request, and toAccountError maps it to
 * `network`. The caller's signal is followed by hand (AbortSignal.any is too new for some browsers).
 */
export function createTimeoutFetch(base: Fetch = globalFetch, timeoutMs: number = REQUEST_TIMEOUT_MS): Fetch {
    return async (input, init: RequestInit = {}) => {
        const controller = new AbortController();
        const callerSignal = init.signal ?? null;
        const followCaller = (): void => controller.abort(callerSignal?.reason);
        if (callerSignal?.aborted) followCaller();
        else callerSignal?.addEventListener('abort', followCaller, { once: true });
        const timer = setTimeout(
            () => controller.abort(new DOMException(`request timed out after ${timeoutMs} ms`, 'AbortError')),
            timeoutMs,
        );
        try {
            return await base(input, { ...init, signal: controller.signal });
        } finally {
            clearTimeout(timer);
            callerSignal?.removeEventListener('abort', followCaller);
        }
    };
}
