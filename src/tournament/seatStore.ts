// Seat tickets of this browser: the secret that proves "I am seat N of tournament X". Lives in localStorage
// so a reload (or a crashed tab) does not lose the seat. When the browser refuses storage (blocked site data,
// private mode, full quota, no localStorage at all) the tickets are kept in memory for the page's lifetime,
// like the storage shim in achievements.ts.

import type { SeatTicket } from './types';

const KEY = 'tournamentTickets';
type Tickets = Record<string, SeatTicket>;

// The last JSON we saved: the fallback when real storage cannot be read or written.
let memoryRaw: string | null = null;
// True after a write that storage refused: what it still holds is older than memoryRaw, so memoryRaw wins.
let storageBehind = false;
const warned = new Set<string>();

function warnOnce(topic: string, message: string, detail: unknown): void {
    if (warned.has(topic)) return;
    warned.add(topic);
    console.warn(`[tournament] ${message}`, detail);
}

function storage(): Storage | null {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage; // null in Node: memory only, no noise
    } catch (error) {
        warnOnce('storage', 'localStorage unavailable, seat tickets are kept in memory only:', error);
        return null;
    }
}

function readRaw(): string | null {
    if (storageBehind && memoryRaw !== null) return memoryRaw;
    try {
        const raw = storage()?.getItem(KEY) ?? null;
        if (raw !== null) return raw;
    } catch (error) {
        warnOnce('storage', 'localStorage unreadable, seat tickets are kept in memory only:', error);
    }
    return memoryRaw;
}

function writeRaw(raw: string): void {
    memoryRaw = raw;
    try {
        storage()?.setItem(KEY, raw);
        storageBehind = false;
    } catch (error) {
        storageBehind = true;
        warnOnce('storage', 'localStorage not writable, seat tickets are kept in memory only:', error);
    }
}

const isTicket = (id: string, value: unknown): value is SeatTicket => {
    if (typeof value !== 'object' || value === null) return false;
    const t = value as Record<string, unknown>;
    return t.tournamentId === id && typeof t.seat === 'number' && typeof t.secret === 'string';
};

function readAll(): Tickets {
    const raw = readRaw();
    if (raw === null) return {};
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        warnOnce('corrupt', 'stored seat tickets are unreadable, ignoring them:', error);
        return {};
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        warnOnce('corrupt', 'stored seat tickets have an unexpected shape, ignoring them:', parsed);
        return {};
    }
    const tickets: Tickets = {};
    for (const [id, value] of Object.entries(parsed)) {
        if (isTicket(id, value)) tickets[id] = value;
        else warnOnce('entry', 'dropping a malformed stored seat ticket:', id);
    }
    return tickets;
}

export function saveTicket(ticket: SeatTicket): void {
    writeRaw(JSON.stringify({ ...readAll(), [ticket.tournamentId]: ticket }));
}

export function ticketFor(tournamentId: string): SeatTicket | null {
    return readAll()[tournamentId] ?? null;
}

export function forgetTicket(tournamentId: string): void {
    const { [tournamentId]: _forgotten, ...rest } = readAll();
    writeRaw(JSON.stringify(rest));
}
