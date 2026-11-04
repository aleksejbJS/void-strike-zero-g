import React from 'react';
import { describe, it, expect, vi, Mock } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { AccountContext, AccountState, AccountStatus } from '../../../account/useAccount';
import { useStartGate } from './useStartGate';

const setup = (status: AccountStatus, isNicknameTaken: Mock, name = 'Alex', nickname: string | null = null) => {
    const launch = vi.fn();
    const value = { status, nickname, isNicknameTaken } as unknown as AccountState;
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
    );
    const { result } = renderHook(() => useStartGate(name, launch), { wrapper });
    return { result, launch };
};

const held = () => {
    let answer!: (taken: boolean) => void;
    const isNicknameTaken = vi.fn().mockReturnValue(new Promise<boolean>(resolve => { answer = resolve; }));
    return { isNicknameTaken, answer: (taken: boolean) => act(async () => { answer(taken); }) };
};

describe('useStartGate', () => {
    it('a second Start before the screen re-renders does not start a second check or match', async () => {
        const { isNicknameTaken, answer } = held();
        const { result, launch } = setup('guest', isNicknameTaken);
        act(() => {
            result.current.requestStart();
            result.current.requestStart(); // same tick: the disabled button cannot stop this one, the ref guard must
        });
        expect(isNicknameTaken).toHaveBeenCalledTimes(1);
        expect(result.current.checking).toBe(true);
        await answer(false);
        expect(launch).toHaveBeenCalledTimes(1);
        expect(launch).toHaveBeenCalledWith('Alex');
        expect(result.current.checking).toBe(false);
    });

    it('can start again after a check that found the name taken', async () => {
        const isNicknameTaken = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
        const { result, launch } = setup('guest', isNicknameTaken);
        await act(async () => { result.current.requestStart(); });
        expect(launch).not.toHaveBeenCalled();
        act(() => { result.current.closeModal(); }); // the Log in window it opened is closed first
        await act(async () => { result.current.requestStart(); });
        expect(launch).toHaveBeenCalledTimes(1);
    });

    it('a taken name opens Log in with the name and the reason', async () => {
        const { result, launch } = setup('guest', vi.fn().mockResolvedValue(true));
        await act(async () => { result.current.requestStart(); });
        expect(launch).not.toHaveBeenCalled();
        expect(result.current.takenName).toBe('Alex');
        expect(result.current.modal).toEqual({
            tab: 'login', nickname: 'Alex', notice: "This name is taken. If it's your account, enter the password",
        });
    });

    it('logged in: starts at once under the account nickname, no check', () => {
        const isNicknameTaken = vi.fn();
        const { result, launch } = setup('loggedIn', isNicknameTaken, 'Zed', 'Alex');
        act(() => { result.current.requestStart(); });
        expect(launch).toHaveBeenCalledWith('Alex');
        expect(isNicknameTaken).not.toHaveBeenCalled();
    });
});
