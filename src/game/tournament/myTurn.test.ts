import { describe, it, expect } from 'vitest';
import { myTurn } from './myTurn';
import { makeSnapshot, patchMatch, publishHost, settle } from './bracketFixtures';

const ready4 = () => makeSnapshot(4);

describe('myTurn: my match is ready', () => {
    it('hosts when I am the host seat; withBot is false against a human', () => {
        const turn = myTurn(ready4(), 0);
        expect(turn).toMatchObject({ kind: 'host', withBot: false });
        expect(turn.kind === 'host' && turn.match.id).toBe('m-0-0');
    });

    it('hosts with a bot when the other seat isBot', () => {
        expect(myTurn(makeSnapshot(4, { bots: [1] }), 0)).toMatchObject({ kind: 'host', withBot: true });
    });

    it('hosts when the other seat is a bot, even if the bot has the lower seat number', () => {
        const snap = makeSnapshot(4, { bots: [0] }); // seat 0 is a bot, seat 1 is the only human in slot 0
        expect(myTurn(snap, 1)).toMatchObject({ kind: 'host', withBot: true });
    });

    it('joins the published host as the guest', () => {
        const snap = publishHost(ready4(), 0, 0, 'peer-abc');
        expect(myTurn(snap, 1)).toMatchObject({ kind: 'join', peerId: 'peer-abc' });
    });

    it('waits for the host when the guest sees no peer id yet', () => {
        expect(myTurn(ready4(), 1)).toMatchObject({ kind: 'wait-host' });
    });

    it('waits instead of guessing when the opponent seat is missing from a torn snapshot', () => {
        const snap = makeSnapshot(4, { bots: [1] });
        const torn = { ...snap, seats: snap.seats.filter(x => x.seat !== 1) };
        expect(myTurn(torn, 0)).toEqual({ kind: 'wait-round' });
    });

    it('keeps hosting after the host reloaded (peer id already published)', () => {
        expect(myTurn(publishHost(ready4(), 0, 0, 'peer-old'), 0).kind).toBe('host');
    });

    it('gives the same answer for the same snapshot on a fresh call (reload)', () => {
        const snap = publishHost(ready4(), 0, 1, 'peer-q');
        expect(myTurn(snap, 3)).toEqual(myTurn(snap, 3));
        expect(myTurn(snap, 2)).toEqual(myTurn(snap, 2));
    });
});

describe('myTurn: after a match', () => {
    it('is eliminated after losing', () => {
        expect(myTurn(settle(ready4(), 0, 0, 0, 10, 3), 1)).toEqual({ kind: 'eliminated' });
    });

    it('waits for the next round after winning while the other semifinal is open', () => {
        expect(myTurn(settle(ready4(), 0, 0, 0, 10, 3), 0)).toEqual({ kind: 'wait-round' });
    });

    it('moves on to the final as soon as both semifinals are done', () => {
        const snap = settle(settle(ready4(), 0, 0, 0, 10, 3), 0, 1, 2, 10, 5);
        expect(myTurn(snap, 0)).toMatchObject({ kind: 'host' });
        expect(myTurn(snap, 2)).toMatchObject({ kind: 'wait-host' });
        expect(myTurn(snap, 1)).toEqual({ kind: 'eliminated' });
    });

    it('is champion after winning the final, the loser is eliminated', () => {
        const snap = settle(settle(settle(ready4(), 0, 0, 0, 10, 3), 0, 1, 2, 10, 5), 1, 0, 2, 4, 10);
        expect(myTurn(snap, 2)).toEqual({ kind: 'champion' });
        expect(myTurn(snap, 0)).toEqual({ kind: 'eliminated' });
    });

    it('is champion when only the final is done and the tournament row still says running', () => {
        const snap = settle(settle(settle(ready4(), 0, 0, 0, 10, 3), 0, 1, 2, 10, 5), 1, 0, 0, 10, 0);
        const stale = { ...snap, tournament: { ...snap.tournament, status: 'running' as const, championSeat: null } };
        expect(myTurn(stale, 0)).toEqual({ kind: 'champion' });
    });

    it('works through all three rounds of an 8-bracket', () => {
        let snap = makeSnapshot(8);
        for (let slot = 0; slot < 4; slot++) snap = settle(snap, 0, slot, slot * 2, 10, 1);
        expect(myTurn(snap, 0)).toMatchObject({ kind: 'host' }); // semifinal vs seat 2
        expect(myTurn(snap, 1)).toEqual({ kind: 'eliminated' });
        snap = settle(snap, 1, 0, 0, 10, 6);
        expect(myTurn(snap, 2)).toEqual({ kind: 'eliminated' });
        expect(myTurn(snap, 0)).toEqual({ kind: 'wait-round' });
        snap = settle(snap, 1, 1, 4, 10, 6);
        expect(myTurn(snap, 4)).toMatchObject({ kind: 'wait-host' });
    });

    it('published-then-settled match → wait-round for the winner seat, eliminated for the loser seat', () => {
        const snap = settle(publishHost(ready4(), 0, 0, 'peer-done'), 0, 0, 0, 10, 7);
        expect(myTurn(snap, 0)).toEqual({ kind: 'wait-round' });
        expect(myTurn(snap, 1)).toEqual({ kind: 'eliminated' });
    });

    it('a walkover loss is an elimination too', () => {
        expect(myTurn(settle(ready4(), 0, 0, 1, 0, 0, 'walkover'), 0)).toEqual({ kind: 'eliminated' });
    });
});

describe('myTurn: no ticket, lobby, expired', () => {
    it('a null seat is a spectator', () => {
        expect(myTurn(ready4(), null)).toEqual({ kind: 'spectator' });
    });

    it('a seat number that is not at this tournament is a spectator', () => {
        expect(myTurn(ready4(), 7)).toEqual({ kind: 'spectator' });
    });

    it('a lobby is a lobby, with or without a seat (the phase comes from the tournament status)', () => {
        const lobby = { ...makeSnapshot(4), matches: [], tournament: { ...makeSnapshot(4).tournament, status: 'lobby' as const } };
        expect(myTurn(lobby, 0)).toEqual({ kind: 'lobby' });
        expect(myTurn(lobby, null)).toEqual({ kind: 'lobby' });
    });

    it('an expired tournament is a spectator even for a seat holder (nothing left to play)', () => {
        const snap = ready4();
        const expired = { ...snap, tournament: { ...snap.tournament, status: 'expired' as const } };
        expect(myTurn(expired, 0)).toEqual({ kind: 'spectator' });
    });

    it('a seat that is on no match is a spectator', () => {
        const snap = patchMatch(ready4(), 0, 0, { seatA: null });
        expect(myTurn(snap, 0)).toEqual({ kind: 'spectator' });
    });

    it('a finished tournament never asks to host, join or wait for a host, even with a stale ready match', () => {
        const stale = publishHost(ready4(), 0, 1, 'peer-stale');
        const finished = { ...stale, tournament: { ...stale.tournament, status: 'finished' as const, championSeat: 0 } };
        for (const seat of [1, 2, 3]) expect(['host', 'join', 'wait-host']).not.toContain(myTurn(finished, seat).kind);
        expect(myTurn(finished, 0)).toEqual({ kind: 'champion' });
    });

    it('a finished tournament shows the champion and everyone else as eliminated', () => {
        const snap = settle(settle(settle(ready4(), 0, 0, 0, 10, 3), 0, 1, 2, 10, 5), 1, 0, 2, 4, 10);
        expect(snap.tournament.status).toBe('finished');
        expect(myTurn(snap, 3)).toEqual({ kind: 'eliminated' });
        expect(myTurn(snap, null)).toEqual({ kind: 'spectator' });
    });
});
