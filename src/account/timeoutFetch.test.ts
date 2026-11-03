import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { REQUEST_TIMEOUT_MS, createTimeoutFetch } from './timeoutFetch';
import { toAccountError } from './accountError';

/** A fetch that never answers by itself: like the real one, it rejects when its signal is (or gets) aborted. */
const hangingFetch = () => vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    if (init?.signal?.aborted) reject(init.signal.reason);
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
}));

describe('createTimeoutFetch', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('aborts a request that has not answered after 15 s', async () => {
        const base = hangingFetch();
        const request = createTimeoutFetch(base)('https://x.test/rest', { method: 'GET' });
        const outcome = request.catch((error: unknown) => error);

        await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
        expect(base.mock.calls[0][1]?.signal?.aborted).toBe(false);
        await vi.advanceTimersByTimeAsync(1);

        const error = await outcome;
        expect(error).toMatchObject({ name: 'AbortError', message: expect.stringContaining('timed out') });
        expect(base.mock.calls[0][1]?.method).toBe('GET');
    });

    it('passes a request through and cancels its timer', async () => {
        const answer = new Response('ok');
        const base = vi.fn().mockResolvedValue(answer);
        await expect(createTimeoutFetch(base)('https://x.test')).resolves.toBe(answer);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("follows the caller's abort signal, including one aborted before the call", async () => {
        const base = hangingFetch();
        const caller = new AbortController();
        const request = createTimeoutFetch(base)('https://x.test', { signal: caller.signal }).catch((e: unknown) => e);
        caller.abort(new DOMException('stop', 'AbortError'));
        expect(await request).toMatchObject({ message: 'stop' });

        const early = new AbortController();
        early.abort(new DOMException('already', 'AbortError'));
        expect(await createTimeoutFetch(base)('https://x.test', { signal: early.signal }).catch((e: unknown) => e))
            .toMatchObject({ message: 'already' });
        expect(vi.getTimerCount()).toBe(0);
    });

    it('a timeout, raw or as supabase-js reports it, maps to network', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const raw = new DOMException('request timed out after 15000 ms', 'AbortError');
        expect(toAccountError(raw, 'test').code).toBe('network');
        // postgrest-js turns a thrown fetch error into { message: `${name}: ${message}`, code: '' }
        expect(toAccountError({ message: `AbortError: ${raw.message}`, code: '' }, 'test').code).toBe('network');
        // auth-js wraps it in an AuthRetryableFetchError
        expect(toAccountError({ name: 'AuthRetryableFetchError', message: raw.message, status: 0 }, 'test').code).toBe('network');
    });
});
