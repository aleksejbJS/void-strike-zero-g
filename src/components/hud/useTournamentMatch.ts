// GameCanvas's tournament duel: runs TournamentMatchFlow while a tournament match is set (no-op otherwise),
// hands GameCanvas the signals its connection callbacks feed in, and the error for the netError banner.

import { MutableRefObject, useEffect, useMemo, useRef, useState } from 'react';
import type { GameState } from '../../types';
import { useUIStore } from '../../store/uiStore';
import type { TournamentMatchRun } from '../../store/tournamentSlice';
import { useTranslation } from '../../i18n/useTranslation';
import { TournamentError } from '../../tournament/types';
import { ERROR_KEYS } from '../tournament/TournamentFrame';
import { TournamentMatchFlow } from './tournamentMatchFlow';

const POLL_MS = 250;

export interface TournamentMatchSignals {
    /** Host: HostSession's onInviteReady. */
    inviteReady: (peerId: string) => void;
    /** ClientSession's onJoined. */
    joined: () => void;
    /** Guest: a snapshot arrived. */
    snapshot: () => void;
    /** ClientSession's onDisconnected. */
    disconnected: () => void;
}

export interface TournamentMatchLink {
    /** Stable for the component's lifetime: safe to capture in GameCanvas's setup effect. */
    signals: TournamentMatchSignals;
    /** A failed tournament call, for the netError banner; null when all is well. */
    error: string | null;
}

export function useTournamentMatch(
    gameState: MutableRefObject<GameState>,
    localId: MutableRefObject<string>,
    run: TournamentMatchRun | null,
): TournamentMatchLink {
    const { actions } = useUIStore();
    const { t } = useTranslation();
    // Read through refs: a new translator or store object must not restart a running duel's flow
    const tRef = useRef(t);
    tRef.current = t;
    const endRef = useRef(actions.endTournamentMatch);
    endRef.current = actions.endTournamentMatch;
    const [error, setError] = useState<string | null>(null);
    const flowRef = useRef<TournamentMatchFlow | null>(null);

    useEffect(() => {
        if (!run) return undefined;
        setError(null);
        const flow = new TournamentMatchFlow({
            run,
            read: () => ({ state: gameState.current, localId: localId.current }),
            end: () => endRef.current(),
            fail: (what, failure) => {
                console.error(`[tournament] ${what} failed`, failure);
                const code = failure instanceof TournamentError ? failure.code : 'unknown';
                setError(tRef.current('tournament.match.error', tRef.current(ERROR_KEYS[code])));
            },
            ok: () => setError(null),
        }, Date.now());
        flowRef.current = flow;
        const timer = setInterval(() => flow.tick(Date.now()), POLL_MS);
        flow.tick(Date.now());
        return () => {
            clearInterval(timer);
            flow.dispose();
            flowRef.current = null;
        };
    }, [run, gameState, localId]);

    const signals = useMemo<TournamentMatchSignals>(() => ({
        inviteReady: peerId => flowRef.current?.inviteReady(peerId),
        joined: () => flowRef.current?.joined(Date.now()),
        snapshot: () => flowRef.current?.snapshot(Date.now()),
        disconnected: () => flowRef.current?.disconnected(),
    }), []);

    return { signals, error };
}
