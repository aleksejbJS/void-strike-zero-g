// Start while the accounts are still starting up, Start under a broken guest name, and Start racing an
// open account window.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { AccountContext, AccountState, AccountStatus } from '../../../account/useAccount';
import { stubAccount } from '../../../test/accountStub';
import { useStartGate } from './useStartGate';
import { TAKEN_CHECK_TIMEOUT_MS } from './useTakenCheck';

let warn: Mock;
beforeEach(() => {
    vi.useFakeTimers();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {}) as unknown as Mock;
});
afterEach(() => {
    warn.mockRestore();
    vi.useRealTimers();
});

/** The gate under an account whose status the test changes with `become`. */
function setup(status: AccountStatus, name = 'Alex', isNicknameTaken: Mock = vi.fn().mockResolvedValue(false)) {
    let account: AccountState = stubAccount({ status, isNicknameTaken });
    const launch = vi.fn();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AccountContext.Provider value={account}>{children}</AccountContext.Provider>
    );
    const view = renderHook(({ field }) => useStartGate(field, launch), { wrapper, initialProps: { field: name } });
    const become = async (next: AccountStatus, nickname: string | null = null) => {
        account = stubAccount({ status: next, nickname, isNicknameTaken });
        view.rerender({ field: name });
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    };
    return { result: view.result, rerender: view.rerender, launch, isNicknameTaken, become };
}

describe('useStartGate while the accounts start up', () => {
    it('waits, busy, then checks the name once the player turns out to be a guest', async () => {
        const { result, launch, isNicknameTaken, become } = setup('loading');
        act(() => { result.current.requestStart(); });
        expect(result.current.checking).toBe(true);
        expect(launch).not.toHaveBeenCalled();
        expect(isNicknameTaken).not.toHaveBeenCalled();

        await become('guest');
        expect(isNicknameTaken).toHaveBeenCalledWith('Alex');
        expect(launch).toHaveBeenCalledWith('Alex');
        expect(result.current.checking).toBe(false);
    });

    it('starts under the account nickname, without a check, when a stored login is restored', async () => {
        const { result, launch, isNicknameTaken, become } = setup('loading', 'Zed');
        act(() => { result.current.requestStart(); });
        await become('loggedIn', 'Alex');
        expect(launch).toHaveBeenCalledWith('Alex');
        expect(isNicknameTaken).not.toHaveBeenCalled();
    });

    it('a guest whose name turns out taken is stopped as usual', async () => {
        const { result, launch, become } = setup('loading', 'Alex', vi.fn().mockResolvedValue(true));
        act(() => { result.current.requestStart(); });
        await become('guest');
        expect(launch).not.toHaveBeenCalled();
        expect(result.current.modal).toMatchObject({ tab: 'login', nickname: 'Alex' });
    });

    it(`starts anyway, with a warning, when the accounts are still loading after ${TAKEN_CHECK_TIMEOUT_MS} ms`, async () => {
        const { result, launch, isNicknameTaken } = setup('loading');
        act(() => { result.current.requestStart(); });
        await act(async () => { await vi.advanceTimersByTimeAsync(TAKEN_CHECK_TIMEOUT_MS - 1); });
        expect(launch).not.toHaveBeenCalled();
        await act(async () => { await vi.advanceTimersByTimeAsync(1); });
        expect(launch).toHaveBeenCalledWith('Alex');
        expect(isNicknameTaken).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('still starting'));
        expect(result.current.checking).toBe(false);
    });

    it('ignores more clicks while it waits', async () => {
        const { result, launch, become } = setup('loading');
        act(() => { result.current.requestStart(); result.current.requestStart(); });
        await become('guest');
        expect(launch).toHaveBeenCalledTimes(1);
    });
});

describe('useStartGate guest name rules', () => {
    it.each(['Al', 'Ａlex', 'Аlex', 'Bot 3', 'Al!'])('does not start under %j and says why', name => {
        const { result, launch } = setup('guest', name);
        act(() => { result.current.requestStart(); });
        expect(launch).not.toHaveBeenCalled();
        expect(result.current.nameProblem).not.toBeNull();
    });

    it('drops the hint once the name is fixed', () => {
        const { result, rerender } = setup('guest', 'Al');
        act(() => { result.current.requestStart(); });
        expect(result.current.nameProblem).toBe('too_short');
        rerender({ field: 'Alex' });
        expect(result.current.nameProblem).toBeNull();
    });

    it.each(['', 'Anonymous'])('still starts under the default name for %j', name => {
        const { result, launch } = setup('guest', name);
        act(() => { result.current.requestStart(); });
        expect(launch).toHaveBeenCalledWith('Anonymous');
        expect(result.current.nameProblem).toBeNull();
    });

    it('applies the rules with accounts disabled too', () => {
        const { result, launch } = setup('disabled', 'Ａlex');
        act(() => { result.current.requestStart(); });
        expect(launch).not.toHaveBeenCalled();
    });
});

describe('useStartGate and an open account window', () => {
    it('does not launch when a window was opened while the check ran', async () => {
        let answer!: (taken: boolean) => void;
        const held = vi.fn().mockReturnValue(new Promise<boolean>(resolve => { answer = resolve; }));
        const { result, launch } = setup('guest', 'Alex', held);
        act(() => { result.current.requestStart(); });
        act(() => { result.current.openModal('signup'); });
        await act(async () => { answer(false); });
        expect(launch).not.toHaveBeenCalled();
        expect(result.current.modal).toMatchObject({ tab: 'signup' }); // left as the player opened it
    });

    it('does not start while a window is open', () => {
        const { result, launch } = setup('guest', 'Anonymous');
        act(() => { result.current.openModal('login'); });
        act(() => { result.current.requestStart(); });
        expect(launch).not.toHaveBeenCalled();
    });
});
