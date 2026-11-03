import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AccountContext, AccountState, AccountStatus } from '../../../account/useAccount';
import { TAKEN_CHECK_TIMEOUT_MS, useTakenCheck } from './useTakenCheck';

let isNicknameTaken: Mock;
let warn: Mock;

const checker = (status: AccountStatus = 'guest') => {
    const value = { status, nickname: null, isNicknameTaken } as unknown as AccountState;
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
    );
    return renderHook(() => useTakenCheck(), { wrapper }).result.current;
};

beforeEach(() => {
    vi.useFakeTimers();
    isNicknameTaken = vi.fn().mockResolvedValue(true);
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {}) as unknown as Mock;
});
afterEach(() => {
    warn.mockRestore();
    vi.useRealTimers();
});

describe('useTakenCheck', () => {
    it('asks the service about the trimmed name of a guest', async () => {
        const check = checker();
        await expect(check('  Alex ')).resolves.toBe(true);
        expect(isNicknameTaken).toHaveBeenCalledWith('Alex');
    });

    it('passes the answer through', async () => {
        isNicknameTaken.mockResolvedValue(false);
        await expect(checker()('Alex')).resolves.toBe(false);
    });

    it.each(['', '   ', 'Anonymous', ' anonymous '])('never asks about %j', async name => {
        await expect(checker()(name)).resolves.toBe(false);
        expect(isNicknameTaken).not.toHaveBeenCalled();
    });

    it.each<AccountStatus>(['disabled', 'loading', 'loggedIn'])('does not ask while the status is %s', async status => {
        await expect(checker(status)('Alex')).resolves.toBe(false);
        expect(isNicknameTaken).not.toHaveBeenCalled();
    });

    it('lets the player through, with a warning, when the service fails', async () => {
        isNicknameTaken.mockRejectedValue(new Error('offline'));
        await expect(checker()('Alex')).resolves.toBe(false);
        expect(warn).toHaveBeenCalled();
    });

    it('lets the player through, with a warning, after 3000 ms without an answer', async () => {
        isNicknameTaken.mockReturnValue(new Promise(() => {}));
        const result = checker()('Alex');
        let settled = false;
        void result.then(() => { settled = true; });
        await act(async () => { await vi.advanceTimersByTimeAsync(TAKEN_CHECK_TIMEOUT_MS - 1); });
        expect(settled).toBe(false);
        await act(async () => { await vi.advanceTimersByTimeAsync(1); });
        await expect(result).resolves.toBe(false);
        expect(TAKEN_CHECK_TIMEOUT_MS).toBe(3000);
        expect(warn).toHaveBeenCalled();
    });

    it('leaves no timer behind after a quick answer', async () => {
        await checker()('Alex');
        expect(vi.getTimerCount()).toBe(0);
    });
});
