// GameCanvas's tournament duel: runs TournamentMatchFlow while a tournament match is set (no-op otherwise),
// hands GameCanvas the signals its connection callbacks and Esc feed in, and what the HUD shows: the error for
// the netError banner, the end screen's countdown, the forfeit hint and the reconnect overlay.

import { MutableRefObject, useEffect, useMemo, useRef, useState } from 'react';
import type { GameState } from '../../types';
import { useUIStore } from '../../store/uiStore';
import type { TournamentMatchRun } from '../../store/tournamentSlice';
import { useTranslation } from '../../i18n/useTranslation';
import { TournamentError } from '../../tournament/types';
import { ERROR_KEYS } from '../tournament/TournamentFrame';
import { BACK_TO_BRACKET_MS, TournamentMatchFlow } from './tournamentMatchFlow';

const POLL_MS = 250;

export interface TournamentMatchSignals {
    /** Host: HostSession's onInviteReady. */
    inviteReady: (peerId: string) => void;
    /** ClientSession's onJoined. */
    joined: () => void;
    /** Guest: a snapshot arrived. */
    snapshot: () => void;
    /** ClientSession's onDisconnected, and a failed reconnect attempt (RejoiningSocket). */
    disconnected: () => void;
    /** The room refused the first join as full. */
    rejected: () => void;
    /** Guest: how to drop the link and dial the host again (tournamentNet hands it over). */
    rejoinReady: (rejoin: () => void) => void;
    /** Esc during the duel. */
    escape: () => void;
}

export interface TournamentMatchLink {
    /** Stable for the component's lifetime: safe to capture in GameCanvas's setup effect. */
    signals: TournamentMatchSignals;
    /** A failed tournament call, for the netError banner; null when all is well. */
    error: string | null;
    /** The end screen's countdown back to the bracket, in whole seconds. */
    backInSec: number;
    /** "Press Esc again to forfeit" is showing. */
    forfeitArmed: boolean;
    /** Guest: the link dropped, dialling the host again. */
    reconnecting: boolean;
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
    const [backInSec, setBackInSec] = useState(BACK_TO_BRACKET_MS / 1000);
    const [forfeitArmed, setForfeitArmed] = useState(false);
    const [reconnecting, setReconnecting] = useState(false);
    const flowRef = useRef<TournamentMatchFlow | null>(null);
    const rejoinRef = useRef<(() => void) | null>(null);

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
            rejoin: () => {
                if (rejoinRef.current) rejoinRef.current();
                else console.warn('[tournament] cannot reconnect: no link to the host was opened');
            },
        }, Date.now());
        flowRef.current = flow;
        const step = () => {
            const now = Date.now();
            flow.tick(now);
            setBackInSec(flow.backInSec(now)); // React skips the render when the second did not change
            setForfeitArmed(flow.forfeitArmed(now));
            setReconnecting(flow.reconnecting);
        };
        const timer = setInterval(step, POLL_MS);
        step();
        return () => {
            clearInterval(timer);
            flow.dispose();
            flowRef.current = null;
            rejoinRef.current = null;
            setForfeitArmed(false);
            setReconnecting(false);
        };
    }, [run, gameState, localId]);

    const signals = useMemo<TournamentMatchSignals>(() => ({
        inviteReady: peerId => flowRef.current?.inviteReady(peerId),
        joined: () => flowRef.current?.joined(Date.now()),
        snapshot: () => flowRef.current?.snapshot(Date.now()),
        disconnected: () => flowRef.current?.disconnected(Date.now()),
        rejected: () => flowRef.current?.rejected(Date.now()),
        rejoinReady: rejoin => { rejoinRef.current = rejoin; },
        escape: () => {
            const flow = flowRef.current;
            if (!flow) return;
            const now = Date.now();
            flow.escape(now);
            setForfeitArmed(flow.forfeitArmed(now)); // the hint shows at once, not on the next poll
        },
    }), []);

    return { signals, error, backInSec, forfeitArmed, reconnecting };
}
