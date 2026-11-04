import { describe, it, expect } from 'vitest';
import type { SeatRow, TournamentSnapshot } from '../../tournament/types';
import { makeSnapshot } from './bracketFixtures';
import { isLobbyExpired, mayStart } from './startRule';

const NOW = Date.parse('2026-11-04T12:00:00Z');
const ago = (sec: number) => new Date(NOW - sec * 1000).toISOString();

/** A lobby: seat n joined n minutes after the creator; `seen` gives each seat's last heartbeat (s ago, null = never). */
const lobby = (seen: (number | null)[], creatorSeat = 0): TournamentSnapshot => {
    const base = makeSnapshot(4, { status: 'lobby' });
    const seats: SeatRow[] = seen.map((s, seat) => ({
        seat, nickname: `P${seat}`, isBot: false, bracketPos: null,
        joinedAt: new Date(NOW - (60 - seat) * 60_000).toISOString(), seenAt: s === null ? null : ago(s),
    }));
    return { tournament: { ...base.tournament, creatorSeat, createdAt: ago(600) }, seats, matches: [] };
};

describe('mayStart (mirrors start_tournament)', () => {
    it('the creator may always start; nobody else while the creator is present', () => {
        const s = lobby([59, 5, 5]);
        expect(mayStart(s, 0, NOW)).toBe(true);
        expect(mayStart(s, 1, NOW)).toBe(false);
        expect(mayStart(s, 2, NOW)).toBe(false);
    });

    it('creator silent for 61 s: the earliest-joined present seat may start, nobody else', () => {
        const s = lobby([61, 5, 5]);
        expect(mayStart(s, 1, NOW)).toBe(true);
        expect(mayStart(s, 2, NOW)).toBe(false);
    });

    it('a silent earlier seat is skipped; a silent seat can never start', () => {
        const s = lobby([61, 90, 5]);
        expect(mayStart(s, 1, NOW)).toBe(false);
        expect(mayStart(s, 2, NOW)).toBe(true);
    });

    it('a creator who never sent a heartbeat counts as silent', () => {
        expect(mayStart(lobby([null, 5]), 1, NOW)).toBe(true);
    });

    it('order follows joined_at, not the seat number', () => {
        const s = lobby([61, 5, 5]);
        s.seats[2].joinedAt = ago(7200); // seat 2 signed up before seat 1
        expect(mayStart(s, 2, NOW)).toBe(true);
        expect(mayStart(s, 1, NOW)).toBe(false);
    });

    it('no seat: no Start', () => {
        expect(mayStart(lobby([61, 5]), null, NOW)).toBe(false);
    });
});

describe('isLobbyExpired', () => {
    it('a lobby older than 30 min is expired; a younger one, or a running tournament, is not', () => {
        const s = lobby([5, 5]);
        expect(isLobbyExpired({ ...s.tournament, createdAt: ago(30 * 60 + 1) }, NOW)).toBe(true);
        expect(isLobbyExpired({ ...s.tournament, createdAt: ago(29 * 60) }, NOW)).toBe(false);
        expect(isLobbyExpired({ ...s.tournament, status: 'running', createdAt: ago(3600) }, NOW)).toBe(false);
    });

    it('an unreadable creation time is not treated as expired', () => {
        expect(isLobbyExpired({ ...lobby([5]).tournament, createdAt: '' }, NOW)).toBe(false);
    });
});
