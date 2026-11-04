// "What should this browser do now?" for one seat, from nothing but the tournament snapshot.
// Pure: a page reload asks again with a fresh snapshot and gets the same answer.

import type { MatchRow, TournamentSnapshot } from '../../tournament/types';

export type MyTurn =
    | { kind: 'lobby' }
    | { kind: 'host'; match: MatchRow; withBot: boolean }
    | { kind: 'join'; match: MatchRow; peerId: string }
    | { kind: 'wait-host'; match: MatchRow } // my match is ready, its host has not published yet
    | { kind: 'wait-round' } // I won, the next opponent is not decided yet
    | { kind: 'eliminated' }
    | { kind: 'champion' }
    | { kind: 'spectator' }; // no ticket, or nothing left to play for this tournament

const SPECTATOR: MyTurn = { kind: 'spectator' };

const readyTurn = (s: TournamentSnapshot, match: MatchRow, mySeat: number): MyTurn => {
    if (match.hostSeat === mySeat) {
        const otherSeat = match.seatA === mySeat ? match.seatB : match.seatA;
        const other = s.seats.find(x => x.seat === otherSeat);
        // A torn snapshot (seats read before the match): do not guess bot or human, wait for the next one
        if (!other) return { kind: 'wait-round' };
        return { kind: 'host', match, withBot: other.isBot };
    }
    if (match.hostPeerId !== null) return { kind: 'join', match, peerId: match.hostPeerId };
    return { kind: 'wait-host', match };
};

/**
 * Decisions beyond the happy path:
 * - 'lobby' is judged by the tournament status alone (a visitor without a seat still sees the lobby).
 * - 'expired' is a spectator for everyone: the tournament is gone, there is nothing to play or wait for.
 * - A null seat, a seat that is not at this tournament, or a seat on no match is a spectator.
 * - My latest match decides: ready -> host/join/wait-host; lost -> eliminated; won the final -> champion;
 *   a ready match whose other seat is missing from the snapshot (torn read) -> wait-round until the next one;
 *   won an earlier round (or my next match still waits for its other seat) -> wait-round.
 * - A finished tournament never asks to play: a match row that still looks open there is stale -> spectator.
 */
export const myTurn = (s: TournamentSnapshot, mySeat: number | null): MyTurn => {
    const { status, championSeat } = s.tournament;
    if (status === 'expired') return SPECTATOR;
    if (status === 'lobby') return { kind: 'lobby' };
    if (mySeat === null || !s.seats.some(x => x.seat === mySeat)) return SPECTATOR;
    if (championSeat === mySeat) return { kind: 'champion' };

    const mine = s.matches
        .filter(m => m.seatA === mySeat || m.seatB === mySeat)
        .sort((x, y) => x.round - y.round);
    const latest = mine[mine.length - 1];
    if (!latest) return SPECTATOR;

    if (latest.status !== 'done' && status === 'finished') return SPECTATOR;
    if (latest.status === 'ready') return readyTurn(s, latest, mySeat);
    if (latest.status === 'waiting') return { kind: 'wait-round' };
    if (latest.winnerSeat !== mySeat) return { kind: 'eliminated' };
    const finalRound = Math.max(...s.matches.map(m => m.round));
    return latest.round === finalRound ? { kind: 'champion' } : { kind: 'wait-round' };
};
