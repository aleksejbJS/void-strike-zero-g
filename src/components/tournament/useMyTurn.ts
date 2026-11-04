// The bracket screen's autopilot: turns myTurn into actions. My match is ready -> start the duel as its host,
// or as the guest once the host published its peer id. While my match is unsettled, keep telling the server
// I am here.

import { useEffect, useMemo } from 'react';
import { myTurn, type MyTurn } from '../../game/tournament/myTurn';
import { useUIStore } from '../../store/uiStore';
import { matchSeen } from '../../tournament/tournamentApi';
import type { MatchRow, SeatTicket, TournamentSnapshot } from '../../tournament/types';
import { isNoShow, markStarted, wasStarted } from './runHistory';

const HEARTBEAT_MS = 10_000;

// A finished (or abandoned) duel is never started again in this page session, even when a stale snapshot still
// shows its match as ready. A guest may join the same match again only under a NEW host peer id: the host
// reloaded and opened a fresh room.
const runKey = (turn: MyTurn): string | null => {
    if (turn.kind === 'host') return `host:${turn.match.id}`;
    if (turn.kind === 'join') return `join:${turn.match.id}:${turn.peerId}`;
    return null;
};

/**
 * My latest match while it is not settled: ready (to play, or played and left unsettled) or waiting for its
 * other seat. Not a match whose current host I could not join in time: there I count as a no-show.
 */
const openMatchOf = (s: TournamentSnapshot, seat: number): MatchRow | null => {
    const latest = s.matches.filter(m => m.seatA === seat || m.seatB === seat).sort((x, y) => y.round - x.round)[0];
    if (!latest || latest.status === 'done' || isNoShow(latest.id, latest.hostPeerId)) return null;
    return latest;
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
    const alreadyPlayed = useMemo(() => key !== null && wasStarted(key), [key]);
    useEffect(() => {
        if (!ticket || key === null || wasStarted(key)) return;
        if (turn.kind !== 'host' && turn.kind !== 'join') return;
        markStarted(key);
        const side = turn.match.seatA === ticket.seat ? 'a' : 'b';
        if (turn.kind === 'host') {
            actions.startTournamentMatch({ ticket, matchId: turn.match.id, role: 'host', withBot: turn.withBot, side });
        } else {
            actions.startTournamentMatch({ ticket, matchId: turn.match.id, role: 'guest', peerId: turn.peerId, withBot: false, side });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- acts on a change of kind or match only
    }, [key]);

    // Heartbeat whenever my match is unsettled, so a player on the bracket is never counted as gone. That
    // includes a duel this page already left (host vanished, Escape): the server's stale rules then favour the
    // side that is still here. Two players who both left keep it open until the server's 15-min timeout.
    const running = snapshot.tournament.status === 'running';
    const heartbeatMatch = ticket !== null && running ? openMatchOf(snapshot, ticket.seat)?.id ?? null : null;
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
