// Loads one board for the Top screen. A new category or period starts a new load; an answer to an
// older request (the player switched meanwhile) is dropped, so the table never shows the wrong board.

import { useCallback, useEffect, useState } from 'react';
import { fetchBoard, type Board, type Period, type RankedStat } from '../../leaderboard/leaderboardApi';

export type BoardState =
    | { status: 'loading' }
    | { status: 'ready'; board: Board }
    | { status: 'error' };

export function useBoard(stat: RankedStat, period: Period): { state: BoardState; retry: () => void } {
    const [state, setState] = useState<BoardState>({ status: 'loading' });
    const [attempt, setAttempt] = useState(0);
    const retry = useCallback(() => setAttempt(n => n + 1), []);

    useEffect(() => {
        let current = true;
        setState({ status: 'loading' });
        fetchBoard(stat, period).then(
            board => { if (current) setState({ status: 'ready', board }); },
            // fetchBoard logs real failures itself ('offline' is expected); the screen offers Retry
            () => { if (current) setState({ status: 'error' }); },
        );
        return () => { current = false; };
    }, [stat, period, attempt]);

    return { state, retry };
}
