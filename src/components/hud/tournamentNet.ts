// The connection of a tournament duel: the host seat runs the room in this browser (HostSession), the guest
// connects to the host's published PeerJS id through a RejoiningSocket, so a dropped link can be dialled again
// mid-duel. GameCanvas plays through the returned socket like any online game.

import { GameMode, MapId } from '../../types';
import type { RoomConfig } from '../../game/net/room';
import { HostSession } from '../../game/net/hostSession';
import { PeerSocket } from '../../game/net/peerSocket';
import { RejoiningSocket } from '../../game/net/rejoiningSocket';
import { MSG } from '../../game/net/protocol';
import type { SessionSocket } from '../../game/net/sessionSocket';
import type { TournamentMatchRun } from '../../store/tournamentSlice';

/** Without input this long, a guest's link is dropped (its PeerJS close can take 60–90 s to arrive). */
export const DUEL_IDLE_KICK_MS = 8_000;

/** maxPlayers counts humans: a vs-bot duel has room for the host only, so a stray second human cannot join. */
export const tournamentHostConfig = (withBot: boolean): RoomConfig => ({
    mode: GameMode.DUEL,
    map: MapId.PIT,
    maxPlayers: withBot ? 1 : 2,
    bots: withBot ? 1 : 0,
    restartMatches: false, // the duel stays on its result; the players go back to the bracket
    spectators: true, // the watch screen
    idleKickMs: DUEL_IDLE_KICK_MS, // a vanished guest must not linger as a frozen ghost (nor block its own rejoin)
});

export interface TournamentNetHandlers {
    /** Host: the room can be joined at this PeerJS id (to be published for the guest and spectators). */
    onInviteReady: (peerId: string) => void;
    onError: (message: string) => void;
    /** Guest: a snapshot arrived from the host (feeds the "host vanished" watchdog). */
    onSnapshot: () => void;
    /** Guest: how to drop the link and dial the host again. */
    onRejoinReady: (rejoin: () => void) => void;
    /** Guest: a reconnect attempt failed. */
    onRejoinFailed: () => void;
}

export interface TournamentNet {
    socket: SessionSocket;
    host: HostSession | null;
}

export const openTournamentNet = (run: TournamentMatchRun, handlers: TournamentNetHandlers): TournamentNet => {
    if (run.role === 'host') {
        const host = new HostSession(tournamentHostConfig(run.withBot), { onInviteReady: handlers.onInviteReady, onError: handlers.onError });
        return { socket: host.localSocket, host };
    }
    if (!run.peerId) throw new Error('[tournament] a guest run needs the host peer id');
    const hostPeerId = run.peerId;
    const socket = new RejoiningSocket(() => new PeerSocket(hostPeerId), handlers.onRejoinFailed);
    socket.on(MSG.SNAPSHOT, () => handlers.onSnapshot()); // ClientSession adds its own handler next to this one
    handlers.onRejoinReady(() => socket.rejoin());
    return { socket, host: null };
};
