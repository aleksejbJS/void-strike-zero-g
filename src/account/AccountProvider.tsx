// Owns the account session for the whole app: finds out at start-up whether someone is logged in,
// runs login / logout (see accountFlows for the step order that keeps progress safe) and keeps the
// cloud copy up to date while logged in. Without Supabase settings it stays 'disabled'.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUIStore } from '../store/uiStore';
import { AccountError } from './accountError';
import type { AccountApi, AccountUser } from './accountApi';
import { completeLogin, logOutFlow } from './accountFlows';
import { accountsConfigured, loadAccountApi } from './loadAccountApi';
import { createSync, Sync } from './sync';
import { AccountContext, AccountState, AccountStatus } from './useAccount';
import { usePushTriggers } from './usePushTriggers';

interface View { status: AccountStatus; nickname: string | null; userId: string | null }

const view = (status: AccountStatus, user: AccountUser | null = null): View =>
    ({ status, nickname: user?.nickname ?? null, userId: user?.id ?? null });

/** Accounts cannot be used right now (disabled, still starting up, or a logout still finishing). */
const unavailable = (): AccountError => new AccountError('network', 'accounts are not available right now');
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

    // Start-up: resolve the backend, then restore a stored session if there is one.
    useEffect(() => {
        let cancelled = false;
        const start = async (): Promise<void> => {
            const api = apiProp !== undefined ? apiProp : accountsConfigured() ? await loadAccountApi() : null;
            if (cancelled) return;
            if (!api) { show(view('disabled')); return; }
            const sync = createSync(api);
            apiRef.current = api;
            syncRef.current = sync;

            let user: AccountUser | null;
            try {
                user = await api.currentUser();
            } catch (error) {
                console.warn('[account] could not check the stored session, playing as a guest:', error);
                if (!cancelled) show(view('guest'));
                return;
            }
            if (cancelled) return;
            if (!user) { show(view('guest')); return; }
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
        if (!api || !sync || status !== 'guest' || running.current === 'logout') throw unavailable();
        if (running.current) throw misuse('log in while another login is running');
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
        if (running.current || !userId) throw misuse('log out while another login or logout is running');
        running.current = 'logout';
        try {
            await logOutFlow({
                api, sync, userId, reloadPlayer,
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

    const isNicknameTaken = useCallback((nick: string): Promise<boolean> => {
        const api = apiRef.current;
        return api ? api.isNicknameTaken(nick) : Promise.reject(unavailable());
    }, []);

    const value: AccountState = useMemo(() => ({
        status: current.status, nickname: current.nickname, signUp, logIn, logOut, isNicknameTaken,
    }), [current, signUp, logIn, logOut, isNicknameTaken]);

    return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
};
