// Owns the account session for the whole app: finds out at start-up whether someone is logged in,
// runs login / logout (see accountFlows for the step order that keeps progress safe) and keeps the
// cloud copy up to date while logged in. Without Supabase settings it stays 'disabled'.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUIStore } from '../store/uiStore';
import { AccountError } from './accountError';
import type { AccountApi, AccountUser } from './accountApi';
import { completeLogin, logOutFlow } from './accountFlows';
import { readDeviceOwner, setAsideForAccount } from './deviceOwner';
import { accountsConfigured, loadAccountApi } from './loadAccountApi';
import { createSync, Sync } from './sync';
import { AccountContext, AccountState, AccountStatus } from './useAccount';
import { usePushTriggers } from './usePushTriggers';

interface View { status: AccountStatus; nickname: string | null; userId: string | null }

const view = (status: AccountStatus, user: AccountUser | null = null): View =>
    ({ status, nickname: user?.nickname ?? null, userId: user?.id ?? null });

/** Accounts cannot be used right now: disabled, or still starting up. */
const unavailable = (): AccountError => new AccountError('network', 'accounts are not available right now');
/** Another login / logout is still finishing (its window may have been closed): try again in a moment. */
const busy = (): AccountError => new AccountError('busy', 'another account request is still running');
/** A programming mistake: the UI offered an action the current state does not allow. */
const misuse = (what: string): Error => new Error(`[account] ${what}`);

export interface AccountProviderProps {
    children: React.ReactNode;
    /** For tests: a ready api, or null for "accounts disabled". Omitted: Supabase, loaded on demand. */
    api?: AccountApi | null;
}

export const AccountProvider: React.FC<AccountProviderProps> = ({ children, api: apiProp }) => {
    const { reloadPlayer } = useUIStore().actions;
    const [current, setCurrent] = useState<View>(() =>
        view(apiProp === null || (apiProp === undefined && !accountsConfigured()) ? 'disabled' : 'loading'));
    const viewRef = useRef(current);
    const apiRef = useRef<AccountApi | null>(null);
    const syncRef = useRef<Sync | null>(null);
    const activeUser = useRef<string | null>(null); // the only account pushes may go to
    const running = useRef<'login' | 'logout' | null>(null); // the flow in progress, if any

    const show = useCallback((next: View) => {
        viewRef.current = next;
        setCurrent(next);
    }, []);

    /** Leaves logged in, without the server: the device becomes a clean guest (see logOutFlow). */
    const leave = useCallback(async (api: AccountApi, sync: Sync, userId: string, sessionGone: boolean): Promise<void> => {
        running.current = 'logout';
        try {
            await logOutFlow({
                api, sync, userId, reloadPlayer, sessionGone,
                becomeGuest: () => {
                    activeUser.current = null;
                    if (syncRef.current !== sync) return; // the provider was torn down meanwhile
                    syncRef.current = createSync(api); // a fresh one for the next login
                    show(view('guest'));
                },
            });
        } finally {
            running.current = null;
        }
    }, [reloadPlayer, show]);

    // The session died by itself while logged in (revoked, refused on refresh, logged out in another tab):
    // the same safe steps as logOut, without asking the server to end a session that is already gone.
    const onSessionEnded = useCallback((): void => {
        const api = apiRef.current;
        const sync = syncRef.current;
        const userId = activeUser.current;
        // Not logged in, or our own login / logout is running (its own signOut ends here too): nothing to do.
        if (viewRef.current.status !== 'loggedIn' || running.current || !api || !sync || !userId) return;
        console.warn(`[account] the session of user ${userId} ended, this device is a guest now`);
        void leave(api, sync, userId, true);
    }, [leave]);
    const onSessionEndedRef = useRef(onSessionEnded);
    useEffect(() => { onSessionEndedRef.current = onSessionEnded; });

    // Start-up: resolve the backend, then restore a stored session if there is one.
    useEffect(() => {
        let cancelled = false;
        let unsubscribe: (() => void) | null = null;
        /** No session any more, but the device still holds an account's progress: keep it for that account. */
        const leaveLostSession = (): void => {
            const owner = readDeviceOwner();
            if (owner === null) return; // a guest's own progress: never touched
            console.warn(`[account] the session of user ${owner} is gone; its progress is kept for its next login here`);
            setAsideForAccount(owner);
            reloadPlayer();
        };
        const start = async (): Promise<void> => {
            const api = apiProp !== undefined ? apiProp : accountsConfigured() ? await loadAccountApi() : null;
            if (cancelled) return;
            if (!api) { show(view('disabled')); return; }
            const sync = createSync(api);
            apiRef.current = api;
            syncRef.current = sync;
            unsubscribe = api.onSessionEnded(() => onSessionEndedRef.current());

            let user: AccountUser | null;
            try {
                user = await api.currentUser();
            } catch (error) {
                // Offline with a known session, currentUser answers from the device; failing here means the
                // session cannot be used at all.
                console.warn('[account] could not check the stored session, playing as a guest:', error);
                user = null;
            }
            if (cancelled) return;
            if (!user) { leaveLostSession(); show(view('guest')); return; }
            await completeLogin(sync, user, reloadPlayer);
            if (cancelled) return;
            activeUser.current = user.id;
            show(view('loggedIn', user));
        };
        start().catch((error: unknown) => {
            console.error('[account] start-up failed, playing as a guest:', error);
            if (!cancelled) show(view('guest'));
        });
        return () => {
            cancelled = true;
            unsubscribe?.();
            syncRef.current?.dispose();
            syncRef.current = null;
            apiRef.current = null;
            activeUser.current = null;
        };
    }, [apiProp, reloadPlayer, show]);

    usePushTriggers(current.userId, syncRef, activeUser);

    const signIn = useCallback(async (call: (api: AccountApi) => Promise<AccountUser>): Promise<void> => {
        const api = apiRef.current;
        const sync = syncRef.current;
        const { status } = viewRef.current;
        if (status === 'loggedIn') throw misuse('log in while already logged in');
        if (!api || !sync || status !== 'guest') throw unavailable();
        if (running.current) throw busy();
        running.current = 'login';
        try {
            const user = await call(api); // rejects with AccountError: the player stays a guest
            await completeLogin(sync, user, reloadPlayer);
            if (syncRef.current !== sync) return; // the provider was torn down meanwhile
            activeUser.current = user.id;
            show(view('loggedIn', user));
        } finally {
            running.current = null;
        }
    }, [reloadPlayer, show]);

    const signUp = useCallback((nick: string, pw: string) => signIn(api => api.signUp(nick, pw)), [signIn]);
    const logIn = useCallback((nick: string, pw: string) => signIn(api => api.logIn(nick, pw)), [signIn]);

    const logOut = useCallback(async (): Promise<void> => {
        const api = apiRef.current;
        const sync = syncRef.current;
        const userId = activeUser.current;
        const { status } = viewRef.current;
        if (status === 'guest') throw misuse('log out while not logged in');
        if (!api || !sync || status !== 'loggedIn') throw unavailable();
        if (running.current) throw busy();
        if (!userId) throw misuse('log out without an active account');
        await leave(api, sync, userId, false);
    }, [leave]);

    const isNicknameTaken = useCallback((nick: string): Promise<boolean> => {
        const api = apiRef.current;
        return api ? api.isNicknameTaken(nick) : Promise.reject(unavailable());
    }, []);

    const value: AccountState = useMemo(() => ({
        status: current.status, nickname: current.nickname, signUp, logIn, logOut, isNicknameTaken,
    }), [current, signUp, logIn, logOut, isNicknameTaken]);

    return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
};
