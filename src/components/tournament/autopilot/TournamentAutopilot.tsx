// Plays this browser's part in its tournaments, whatever tournament screen is open (list, bracket, watch):
// one SeatPilot per held seat ticket keeps the lobby seat present (lobby_seen), starts my duel when it is
// ready and heartbeats my unsettled match (useMyTurn). It also retries the host's queued results (reportOutbox).
// A tournament that is over (finished, expired, gone) is let go for the rest of the page session.

import React, { useCallback, useEffect, useState } from 'react';
import { heldTickets, onTicketsChanged } from '../../../tournament/seatStore';
import { lobbySeen } from '../../../tournament/tournamentApi';
import { TOURNAMENT_NOT_FOUND, type SeatTicket, type TournamentSnapshot } from '../../../tournament/types';
import { useTournament } from '../../../tournament/useTournament';
import type { LiveTournament } from '../../../tournament/liveTournaments';
import { isLobbyExpired } from '../../../game/tournament/startRule';
import { retryReports } from './reportOutbox';
import { useMyTurn } from './useMyTurn';

const LOBBY_SEEN_MS = 15_000;
const REPORT_RETRY_MS = 5_000;

// Tournaments with nothing left to do, for this page session (module level: the screens remount often)
const retired = new Set<string>();

/** Test helper: a fresh page session. */
export const forgetRetired = (): void => retired.clear();

const isOver = ({ snapshot, error }: LiveTournament, now: number): boolean => {
    if (error?.message === TOURNAMENT_NOT_FOUND) return true;
    if (!snapshot) return false;
    const { status } = snapshot.tournament;
    return status === 'finished' || status === 'expired' || isLobbyExpired(snapshot.tournament, now);
};

const useLobbyHeartbeat = (ticket: SeatTicket | null): void => {
    useEffect(() => {
        if (!ticket) return undefined;
        const beat = () => {
            lobbySeen(ticket).catch((failure: unknown) => console.warn('[tournament] lobbySeen failed, retrying in 15 s', failure));
        };
        beat();
        const timer = setInterval(beat, LOBBY_SEEN_MS);
        return () => clearInterval(timer);
    }, [ticket]);
};

const RunningPilot: React.FC<{ snapshot: TournamentSnapshot; ticket: SeatTicket }> = ({ snapshot, ticket }) => {
    useMyTurn(snapshot, ticket);
    return null;
};

const SeatPilot: React.FC<{ ticket: SeatTicket; onOver: (id: string) => void }> = ({ ticket, onOver }) => {
    const live = useTournament(ticket.tournamentId);
    const over = isOver(live, Date.now());
    useEffect(() => {
        if (over) onOver(ticket.tournamentId);
    }, [over, onOver, ticket.tournamentId]);
    const status = live.snapshot?.tournament.status;
    useLobbyHeartbeat(status === 'lobby' && !over ? ticket : null);
    if (over || status !== 'running' || !live.snapshot) return null;
    return <RunningPilot snapshot={live.snapshot} ticket={ticket} />;
};

const activeTickets = (): SeatTicket[] => heldTickets().filter(t => !retired.has(t.tournamentId));

export const TournamentAutopilot: React.FC = () => {
    const [tickets, setTickets] = useState<SeatTicket[]>(activeTickets);
    useEffect(() => onTicketsChanged(() => setTickets(activeTickets())), []);
    const letGo = useCallback((id: string) => {
        retired.add(id);
        setTickets(activeTickets());
    }, []);

    useEffect(() => {
        void retryReports();
        const timer = setInterval(() => { void retryReports(); }, REPORT_RETRY_MS);
        return () => clearInterval(timer);
    }, []);

    return <>{tickets.map(ticket => <SeatPilot key={ticket.tournamentId} ticket={ticket} onOver={letGo} />)}</>;
};
