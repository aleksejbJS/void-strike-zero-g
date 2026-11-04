import { describe, it, expect, vi } from 'vitest';
import type { JoinAccepted } from '../../game/net/protocol';
import type { SessionCallbacks } from '../../game/net/clientSession';
import { withTournamentSignals } from './tournamentSessionCallbacks';
import type { TournamentMatchSignals } from './useTournamentMatch';

const base = (): SessionCallbacks => ({
    onJoined: vi.fn(), onRejected: vi.fn(), onConnectionError: vi.fn(), onDisconnected: vi.fn(), onEvents: vi.fn(),
});
const signals = (): TournamentMatchSignals => ({
    inviteReady: vi.fn(), joined: vi.fn(), snapshot: vi.fn(), disconnected: vi.fn(), rejoinReady: vi.fn(), escape: vi.fn(),
});
const info = { id: 'p1' } as JoinAccepted;

describe('withTournamentSignals', () => {
    it('outside a tournament: the callbacks are unchanged', () => {
        const callbacks = base();
        expect(withTournamentSignals(callbacks, null)).toBe(callbacks);
    });

    it('onJoined sets the game up first, then tells the duel', () => {
        const callbacks = base();
        const s = signals();
        const order: string[] = [];
        vi.mocked(callbacks.onJoined).mockImplementation(() => order.push('game'));
        vi.mocked(s.joined).mockImplementation(() => order.push('duel'));
        withTournamentSignals(callbacks, s).onJoined(info);
        expect(callbacks.onJoined).toHaveBeenCalledWith(info);
        expect(order).toEqual(['game', 'duel']);
    });

    it('a lost link goes to the duel (it reconnects), not to the "disconnected" error', () => {
        const callbacks = base();
        const s = signals();
        withTournamentSignals(callbacks, s).onDisconnected();
        expect(s.disconnected).toHaveBeenCalledTimes(1);
        expect(callbacks.onDisconnected).not.toHaveBeenCalled();
    });

    it('everything else passes through', () => {
        const callbacks = base();
        const wrapped = withTournamentSignals(callbacks, signals());
        wrapped.onRejected('full');
        wrapped.onConnectionError('boom');
        wrapped.onEvents([]);
        expect(callbacks.onRejected).toHaveBeenCalledWith('full');
        expect(callbacks.onConnectionError).toHaveBeenCalledWith('boom');
        expect(callbacks.onEvents).toHaveBeenCalledWith([]);
    });
});
