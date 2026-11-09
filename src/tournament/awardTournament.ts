// Turns a bracket into achievements: Champion, Finalist (only once the tournament is finished) and
// Flawless (a played 10:0 win, as soon as the match is done). Safe to call on every snapshot: what was
// already awarded is remembered per tournament (champion, finalist) and per match (flawless), in
// localStorage and, when storage is refused, in memory for the page's lifetime.

import { achievementManager } from '../game/systems/achievements';
import { tournamentAwards } from '../game/tournament/awards';
import { addStats } from '../game/stats/lifetimeStats';
import { notifyProgressChanged } from '../account/progressEvents';
import type { TournamentSnapshot } from './types';

const KEY = 'tournamentAwarded';

interface Award { key: string; achievementId: string }

// Every key awarded in this page session. Also the fallback when storage cannot be read or written.
const memory = new Set<string>();

function readStored(): string[] {
    try {
        const raw = localStorage.getItem(KEY);
        if (raw === null) return [];
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter((k): k is string => typeof k === 'string');
        console.warn('[tournament] stored awards have an unexpected shape, ignoring them:', parsed);
    } catch (error) {
        console.warn('[tournament] stored awards are unreadable, ignoring them:', error);
    }
    return [];
}

function writeStored(keys: Iterable<string>): void {
    try {
        localStorage.setItem(KEY, JSON.stringify([...keys]));
    } catch (error) {
        console.warn('[tournament] awards could not be saved, they are kept in memory only:', error);
    }
}

function candidates(s: TournamentSnapshot, seat: number): Award[] {
    const awards = tournamentAwards(s, seat);
    const id = s.tournament.id;
    const list: Award[] = awards.flawlessMatchIds.map(matchId => ({ key: `flawless:${matchId}`, achievementId: 'tournament_flawless' }));
    // Finalist and champion are only certain once the bracket is closed
    if (s.tournament.status === 'finished') {
        if (awards.champion) list.push({ key: `champion:${id}`, achievementId: 'tournament_champion' });
        if (awards.finalist) list.push({ key: `finalist:${id}`, achievementId: 'tournament_finalist' });
    }
    return list;
}

/** Idempotent: each award is paid out once, however often the same bracket is passed in. */
export function awardTournament(s: TournamentSnapshot, seat: number): void {
    const pending = candidates(s, seat).filter(a => !memory.has(a.key));
    if (pending.length === 0) return; // the common case: no storage access at all

    const known = new Set(readStored());
    const fresh = pending.filter(a => !known.has(a.key));
    for (const award of pending) memory.add(award.key);
    if (fresh.length === 0) return; // awarded before, in an earlier page session

    // Before the achievements: a first-ever counter load is seeded from them and would already include this title
    const titles = fresh.filter(a => a.achievementId === 'tournament_champion').length;
    if (titles > 0) addStats({ tournamentsWon: titles });
    for (const award of fresh) achievementManager.updateProgress(award.achievementId);
    writeStored(new Set([...known, ...memory]));
    notifyProgressChanged(); // a logged-in player's new awards and counters go to the cloud, even for a repeat title
}

/** Forgets what was awarded (tests, and a future "reset progress"); `keepStorage` simulates a page reload. */
export function forgetAwarded(options: { keepStorage?: boolean } = {}): void {
    memory.clear();
    if (options.keepStorage) return;
    try {
        localStorage.removeItem(KEY);
    } catch (error) {
        console.warn('[tournament] stored awards could not be cleared:', error);
    }
}
