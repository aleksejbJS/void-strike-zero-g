// Runs one tournament action (sign up, create, start, leave) at a time and keeps what the screen shows about
// it: busy while it runs, then the error code of a failure, which the screen turns into its message.

import { useCallback, useState } from 'react';
import { TournamentError, type TournamentErrorCode } from '../../tournament/types';

/** The code to show for a failure. The API only throws TournamentErrors; anything else is a bug: logged. */
export const toErrorCode = (error: unknown): TournamentErrorCode => {
    if (error instanceof TournamentError) return error.code;
    console.error('[tournament] unexpected error', error);
    return 'unknown';
};

export interface TournamentCall {
    busy: boolean;
    error: TournamentErrorCode | null;
    run: (work: () => Promise<void>) => Promise<void>;
}

export const useTournamentCall = (): TournamentCall => {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<TournamentErrorCode | null>(null);
    const run = useCallback(async (work: () => Promise<void>) => {
        setBusy(true);
        setError(null);
        try {
            await work();
        } catch (failure) {
            setError(toErrorCode(failure));
        } finally {
            setBusy(false);
        }
    }, []);
    return { busy, error, run };
};
