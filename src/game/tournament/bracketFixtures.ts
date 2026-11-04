// Test helpers: build a tournament snapshot and move it forward like the server's settle() does.
// Bot vs bot matches are NOT auto-resolved here: tests that use bots keep a human in every match.

import type {
    DecidedBy, MatchRow, SeatRow, TournamentSnapshot, TournamentStatus,
} from '../../tournament/types';

interface SnapshotOptions {
    bots?: number[]; // seats that are bots (default: none, every seat is human)
    status?: TournamentStatus;
}

const hostOf = (a: number | null, b: number | null, bots: number[]): number | null => {
    const humans = [a, b].filter((x): x is number => x !== null && !bots.includes(x));
    return humans.length ? Math.min(...humans) : null;
};

const waitingMatch = (round: number, slot: number): MatchRow => ({
    id: `m-${round}-${slot}`, round, slot, seatA: null, seatB: null, hostSeat: null, hostPeerId: null,
    status: 'waiting', scoreA: 0, scoreB: 0, winnerSeat: null, decidedBy: null, readyAt: null,
});

/** A fresh bracket: seat n sits at bracket position n, round 0 is ready, later rounds wait. */
export const makeSnapshot = (size: 4 | 8, options: SnapshotOptions = {}): TournamentSnapshot => {
    const bots = options.bots ?? [];
    const seats: SeatRow[] = Array.from({ length: size }, (_, seat) => ({
        seat, nickname: `P${seat}`, isBot: bots.includes(seat), bracketPos: seat, joinedAt: '2026-11-04T10:00:00Z', seenAt: null,
    }));
    const matches: MatchRow[] = [];
    for (let round = 0, count = size / 2; count >= 1; round++, count /= 2) {
        for (let slot = 0; slot < count; slot++) matches.push(waitingMatch(round, slot));
    }
    for (const m of matches.filter(x => x.round === 0)) {
        m.seatA = m.slot * 2;
        m.seatB = m.slot * 2 + 1;
        m.status = 'ready';
        m.hostSeat = hostOf(m.seatA, m.seatB, bots);
        m.readyAt = '2026-11-04T10:05:00Z';
    }
    return {
        tournament: {
            id: 't1', name: 'Test cup', status: options.status ?? 'running', size, creatorSeat: 0,
            createdAt: '2026-11-04T10:00:00Z', startedAt: '2026-11-04T10:05:00Z', finishedAt: null, championSeat: null,
        },
        seats,
        matches,
    };
};

const clone = (s: TournamentSnapshot): TournamentSnapshot => ({
    tournament: { ...s.tournament },
    seats: s.seats.map(x => ({ ...x })),
    matches: s.matches.map(x => ({ ...x })),
});

const find = (s: TournamentSnapshot, round: number, slot: number): MatchRow => {
    const m = s.matches.find(x => x.round === round && x.slot === slot);
    if (!m) throw new Error(`fixture: no match (${round}, ${slot})`);
    return m;
};

/** Returns a copy with `patch` applied to one match. */
export const patchMatch = (
    s: TournamentSnapshot, round: number, slot: number, patch: Partial<MatchRow>,
): TournamentSnapshot => {
    const next = clone(s);
    Object.assign(find(next, round, slot), patch);
    return next;
};

/** Returns a copy where the host published its peer id for a match. */
export const publishHost = (s: TournamentSnapshot, round: number, slot: number, peerId: string) =>
    patchMatch(s, round, slot, { hostPeerId: peerId });

/** Returns a copy where a match is decided; the winner moves on, the final finishes the tournament. */
export const settle = (
    s: TournamentSnapshot, round: number, slot: number, winnerSeat: number,
    scoreA: number, scoreB: number, decidedBy: DecidedBy = 'played',
): TournamentSnapshot => {
    const next = clone(s);
    Object.assign(find(next, round, slot), { status: 'done', winnerSeat, scoreA, scoreB, decidedBy });
    const bots = next.seats.filter(x => x.isBot).map(x => x.seat);
    const finalRound = Math.max(...next.matches.map(x => x.round));
    if (round === finalRound) {
        next.tournament.status = 'finished';
        next.tournament.championSeat = winnerSeat;
        return next;
    }
    const target = find(next, round + 1, Math.floor(slot / 2));
    if (slot % 2 === 0) target.seatA = winnerSeat; else target.seatB = winnerSeat;
    if (target.seatA !== null && target.seatB !== null) {
        target.status = 'ready';
        target.hostSeat = hostOf(target.seatA, target.seatB, bots);
        target.readyAt = '2026-11-04T10:20:00Z';
    }
    return next;
};
