// Who may press Start in a lobby, mirroring start_tournament in the SQL (the server stays the authority):
// the creator; or, once the creator has been silent for 60 s (no lobby heartbeat: tab closed), the
// earliest-joined seat that is still present. Also: a lobby too old to start at all.

import type { SeatRow, TournamentRow, TournamentSnapshot } from '../../tournament/types';

export const PRESENCE_MS = 60_000; // a seat seen within this is present
export const LOBBY_OPEN_MS = 30 * 60_000; // an unstarted lobby expires after 30 min

const timeOf = (iso: string | null): number => (iso === null ? NaN : Date.parse(iso));

const isPresent = (seat: SeatRow, now: number): boolean => {
    const seen = timeOf(seat.seenAt);
    return Number.isFinite(seen) && seen >= now - PRESENCE_MS;
};

export const mayStart = (s: TournamentSnapshot, mySeat: number | null, now: number): boolean => {
    if (mySeat === null) return false;
    const { creatorSeat } = s.tournament;
    if (mySeat === creatorSeat) return true;
    const creator = s.seats.find(x => x.seat === creatorSeat);
    if (creator && isPresent(creator, now)) return false;
    const standIn = s.seats
        .filter(x => !x.isBot && x.seat !== creatorSeat && isPresent(x, now))
        .sort((a, b) => timeOf(a.joinedAt) - timeOf(b.joinedAt) || a.seat - b.seat)[0];
    return standIn?.seat === mySeat;
};

/** A lobby nobody started within 30 min: the server answers not_open, so the screen says expired. */
export const isLobbyExpired = (t: TournamentRow, now: number): boolean =>
    t.status === 'lobby' && timeOf(t.createdAt) + LOBBY_OPEN_MS < now;
