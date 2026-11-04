// The bracket screen's autopilot: turns myTurn into actions. My match is ready -> start the duel as its host,
// or as the guest once the host published its peer id. While waiting, keep telling the server I am here.

import { useEffect, useMemo } from 'react';
import { myTurn, type MyTurn } from '../../game/tournament/myTurn';
import { useUIStore } from '../../store/uiStore';
import { matchSeen } from '../../tournament/tournamentApi';
import type { MatchRow, SeatTicket, TournamentSnapshot } from '../../tournament/types';

const HEARTBEAT_MS = 10_000;

// Runs started in this page session. A finished (or abandoned) duel is never started again, even when a stale
// snapshot still shows its match as ready. A guest may join the same match again only under a NEW host peer
// id: the host reloaded and opened a fresh room.
const startedRuns = new Set<string>();

/** Test helper: a fresh page session. */
export const forgetStartedRuns = (): void => startedRuns.clear();

const runKey = (turn: MyTurn): string | null => {
    if (turn.kind === 'host') return `host:${turn.match.id}`;
    if (turn.kind === 'join') return `join:${turn.match.id}:${turn.peerId}`;
    return null;
};

/** The match a waiting seat belongs to: the ready one (wait-host) or the next one still waiting for its other seat. */
const openMatchOf = (s: TournamentSnapshot, seat: number): MatchRow | null => {
    const mine = s.matches.filter(m => m.status !== 'done' && (m.seatA === seat || m.seatB === seat));
    return mine.sort((x, y) => y.round - x.round)[0] ?? null;
};

export interface MyTurnState {
    turn: MyTurn;
    /** host / join for a duel this page already ran: the snapshot is stale, the server is settling that match. */
    alreadyPlayed: boolean;
}

export const useMyTurn = (snapshot: TournamentSnapshot, ticket: SeatTicket | null): MyTurnState => {
    const { actions } = useUIStore();
    const turn = useMemo(() => myTurn(snapshot, ticket?.seat ?? null), [snapshot, ticket]);

    // Start my duel: once per kind and match (and host peer id), never twice in a page session
    const key = runKey(turn);
    // Judged when the key first shows up, before the effect below records a fresh start
    const alreadyPlayed = useMemo(() => key !== null && startedRuns.has(key), [key]);
    useEffect(() => {
        if (!ticket || key === null || startedRuns.has(key)) return;
        if (turn.kind !== 'host' && turn.kind !== 'join') return;
        startedRuns.add(key);
        const side = turn.match.seatA === ticket.seat ? 'a' : 'b';
        if (turn.kind === 'host') {
            actions.startTournamentMatch({ ticket, matchId: turn.match.id, role: 'host', withBot: turn.withBot, side });
        } else {
            actions.startTournamentMatch({ ticket, matchId: turn.match.id, role: 'guest', peerId: turn.peerId, withBot: false, side });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- acts on a change of kind or match only
    }, [key]);

    // Heartbeat while waiting, so a waiting player is never counted as gone
    const waiting = ticket !== null && (turn.kind === 'wait-host' || turn.kind === 'wait-round');
    const heartbeatMatch = waiting ? openMatchOf(snapshot, ticket.seat)?.id ?? null : null;
    useEffect(() => {
        if (!ticket || heartbeatMatch === null) return undefined;
        const beat = () => {
            matchSeen(heartbeatMatch, ticket).catch((failure: unknown) => console.warn('[tournament] matchSeen failed, retrying in 10 s', failure));
        };
        beat();
        const timer = setInterval(beat, HEARTBEAT_MS);
        return () => clearInterval(timer);
    }, [heartbeatMatch, ticket]);

    return { turn, alreadyPlayed };
};
