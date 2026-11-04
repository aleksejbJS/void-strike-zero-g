// Shared set-up for the AccountProvider tests: fake timers, a plain-object localStorage, a hand-written
// fake AccountApi and a mounted <UIProvider><AccountProvider> with a probe exposing both contexts.
// Call inside a describe block.

import React from 'react';
import { act, render, RenderResult } from '@testing-library/react';
import { afterEach, beforeEach, vi, Mock } from 'vitest';
import { achievementManager } from '../game/systems/achievements';
import { AccountError } from '../account/accountError';
import type { AccountApi, AccountUser } from '../account/accountApi';
import { AccountProvider } from '../account/AccountProvider';
import { AccountState, useAccount } from '../account/useAccount';
import { PlayerSnapshot } from '../account/snapshot';
import { UIProvider, useUIStore } from '../store/uiStore';

type UIState = ReturnType<typeof useUIStore>['state'];

export const ALEX: AccountUser = { id: 'user-1', nickname: 'Alex' };
export const BO: AccountUser = { id: 'user-2', nickname: 'Bo' };
export const snap = (xp: number): PlayerSnapshot => ({ achievements: {}, xp, look: null });
export const networkError = (): AccountError => new AccountError('network', 'offline');

/** A promise the test settles by hand, to hold an api call in flight. */
export function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(r => { resolve = r; });
    return { promise, resolve };
}

export type FakeApi = { [K in keyof AccountApi]: Mock };

export interface AccountHarness {
    readonly store: Record<string, string>;
    readonly api: FakeApi;
    readonly warn: Mock;
    /** The latest value of useAccount(). */
    account(): AccountState;
    /** The latest UI store state (to check reloadPlayer ran). */
    ui(): UIState;
    /** Renders the providers with the fake api (or the given one; null = accounts disabled). */
    mount(api?: AccountApi | null): RenderResult;
    /** Renders the providers without an api prop, as the app does (Supabase from the env). */
    mountFromEnv(): RenderResult;
    /** Lets pending promises (and zero-delay timers) run. */
    settle(): Promise<void>;
    advance(ms: number): Promise<void>;
    /** The snapshots passed to saveSnapshot for this user, in order. */
    savedFor(userId: string): PlayerSnapshot[];
    /** Logs the mounted (guest) provider in as `user`. */
    loginAs(user: AccountUser): Promise<void>;
    /** Plays "the session ended by itself" to every onSessionEnded listener, then lets things settle. */
    endSession(): Promise<void>;
    /** How many onSessionEnded listeners are subscribed now. */
    sessionListeners(): number;
}

export function installAccountHarness(): AccountHarness {
    const h = {} as { -readonly [K in keyof AccountHarness]: AccountHarness[K] };
    let latest: AccountState | null = null;
    let uiState: UIState | null = null;
    const sessionEnded = new Set<() => void>();

    const Probe: React.FC = () => {
        latest = useAccount();
        uiState = useUIStore().state;
        return null;
    };

    h.account = () => {
        if (!latest) throw new Error('AccountProvider is not mounted');
        return latest;
    };
    h.ui = () => {
        if (!uiState) throw new Error('UIProvider is not mounted');
        return uiState;
    };
    h.advance = ms => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
    h.settle = async () => {
        for (let i = 0; i < 5; i++) await h.advance(0);
    };
    // StrictMode like the app: effects run twice on mount, which the start-up must survive.
    const renderWith = (props: { api?: AccountApi | null }) => render(
        <React.StrictMode>
            <UIProvider>
                <AccountProvider {...props}><Probe /></AccountProvider>
            </UIProvider>
        </React.StrictMode>,
    );
    h.mount = (api = h.api as unknown as AccountApi) => renderWith({ api });
    h.mountFromEnv = () => renderWith({});
    h.savedFor = userId => h.api.saveSnapshot.mock.calls
        .filter(([id]) => id === userId)
        .map(([, snapshot]) => snapshot as PlayerSnapshot);
    h.endSession = async () => {
        for (const listener of [...sessionEnded]) act(() => listener());
        await h.settle();
    };
    h.sessionListeners = () => sessionEnded.size;
    h.loginAs = async user => {
        h.api.logIn.mockResolvedValue(user);
        await act(async () => { await h.account().logIn(user.nickname, 'secret'); });
    };

    beforeEach(() => {
        vi.useFakeTimers();
        // The global test setup replaces localStorage methods with empty mocks: back them with a plain object.
        const store: Record<string, string> = {};
        const mocks = localStorage as unknown as Record<'getItem' | 'setItem' | 'removeItem', Mock>;
        mocks.getItem.mockReset().mockImplementation((key: string) => (key in store ? store[key] : null));
        mocks.setItem.mockReset().mockImplementation((key: string, value: string) => { store[key] = value; });
        mocks.removeItem.mockReset().mockImplementation((key: string) => { delete store[key]; });
        h.store = store;
        achievementManager.reset();
        h.warn = vi.spyOn(console, 'warn').mockImplementation(() => {}) as unknown as Mock;
        h.api = {
            signUp: vi.fn().mockResolvedValue(ALEX),
            logIn: vi.fn().mockResolvedValue(ALEX),
            logOut: vi.fn().mockResolvedValue(undefined),
            currentUser: vi.fn().mockResolvedValue(null),
            isNicknameTaken: vi.fn().mockResolvedValue(false),
            fetchSnapshot: vi.fn().mockResolvedValue(null),
            saveSnapshot: vi.fn().mockResolvedValue(undefined),
            onSessionEnded: vi.fn((listener: () => void) => {
                sessionEnded.add(listener);
                return () => { sessionEnded.delete(listener); };
            }),
        };
        sessionEnded.clear();
        latest = null;
        uiState = null;
    });

    afterEach(() => {
        h.warn.mockRestore();
        vi.useRealTimers();
    });

    return h;
}
