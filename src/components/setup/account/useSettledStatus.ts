// "Wait until the accounts know who is playing": while the start-up still checks the stored session the
// status is 'loading'. Start waits for it (a budget at most), so a restored login starts under its nickname.

import { useCallback, useEffect, useRef } from 'react';
import type { AccountStatus } from '../../../account/useAccount';

type Waiter = (status: AccountStatus) => void;

/**
 * Returns `settled(budgetMs)`: resolves with the status once it is not 'loading' any more, or with 'loading'
 * when the budget runs out first. Never rejects. On unmount every waiter resolves at once (the caller checks
 * whether it is still mounted).
 */
export function useSettledStatus(status: AccountStatus): (budgetMs: number) => Promise<AccountStatus> {
    const latest = useRef(status);
    const waiters = useRef(new Set<Waiter>());

    useEffect(() => {
        latest.current = status;
        if (status === 'loading') return;
        for (const done of [...waiters.current]) done(status);
    }, [status]);

    useEffect(() => {
        const pending = waiters.current;
        return () => { for (const done of [...pending]) done(latest.current); };
    }, []);

    return useCallback((budgetMs: number) => new Promise<AccountStatus>(resolve => {
        if (latest.current !== 'loading') { resolve(latest.current); return; }
        const finish: Waiter = settledAs => {
            clearTimeout(timer);
            waiters.current.delete(finish);
            resolve(settledAs);
        };
        const timer = setTimeout(() => finish(latest.current), budgetMs);
        waiters.current.add(finish);
    }), []);
}
