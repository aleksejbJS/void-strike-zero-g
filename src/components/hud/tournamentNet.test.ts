import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameMode, MapId } from '../../types';
import { MSG } from '../../game/net/protocol';
import { HostSession } from '../../game/net/hostSession';
import { PeerSocket } from '../../game/net/peerSocket';
import type { TournamentMatchRun } from '../../store/tournamentSlice';
import { openTournamentNet, tournamentHostConfig } from './tournamentNet';

vi.mock('../../game/net/hostSession', () => ({
    HostSession: vi.fn().mockImplementation(() => ({ localSocket: { kind: 'local' } })),
}));
vi.mock('../../game/net/peerSocket', async () => {
    const { EmitterSocket } = await import('../../game/net/sessionSocket');
    class FakePeerSocket extends EmitterSocket {
        constructor(readonly hostPeerId: string) { super(); }
        emit() {}
        disconnect() {}
        fire(event: string, data?: unknown) { this.dispatch(event, data); }
    }
    return { PeerSocket: vi.fn().mockImplementation((id: string) => new FakePeerSocket(id)) };
});

const ticket = { tournamentId: 't1', seat: 0, secret: 's' };
const hostRun = (withBot: boolean): TournamentMatchRun => ({ ticket, matchId: 'm1', role: 'host', withBot, side: 'a' });
const handlers = () => ({ onInviteReady: vi.fn(), onError: vi.fn(), onSnapshot: vi.fn() });

beforeEach(() => { vi.mocked(HostSession).mockClear(); vi.mocked(PeerSocket).mockClear(); });

describe('tournamentHostConfig', () => {
    it('a vs-bot duel has one bot and room for no second human', () => {
        expect(tournamentHostConfig(true)).toEqual({ mode: GameMode.DUEL, map: MapId.PIT, maxPlayers: 1, bots: 1, restartMatches: false });
    });

    it('a duel between two humans has no bot and room for both', () => {
        expect(tournamentHostConfig(false)).toEqual({ mode: GameMode.DUEL, map: MapId.PIT, maxPlayers: 2, bots: 0, restartMatches: false });
    });
});

describe('openTournamentNet', () => {
    it('the host runs a HostSession with the duel config and plays through its local socket', () => {
        const h = handlers();
        const net = openTournamentNet(hostRun(true), h);
        expect(HostSession).toHaveBeenCalledWith(tournamentHostConfig(true), { onInviteReady: h.onInviteReady, onError: h.onError });
        expect(net.host).not.toBeNull();
        expect(net.socket).toEqual({ kind: 'local' });
        expect(PeerSocket).not.toHaveBeenCalled();
    });

    it('the guest connects to the published peer id and reports every snapshot', () => {
        const h = handlers();
        const net = openTournamentNet({ ticket, matchId: 'm1', role: 'guest', peerId: 'peer-x', withBot: false, side: 'b' }, h);
        expect(PeerSocket).toHaveBeenCalledWith('peer-x');
        expect(net.host).toBeNull();
        (net.socket as unknown as { fire: (e: string) => void }).fire(MSG.SNAPSHOT);
        expect(h.onSnapshot).toHaveBeenCalledTimes(1);
        expect(HostSession).not.toHaveBeenCalled();
    });

    it('a guest run without a peer id is a bug: it throws', () => {
        expect(() => openTournamentNet({ ticket, matchId: 'm1', role: 'guest', withBot: false, side: 'b' }, handlers())).toThrow();
    });
});
