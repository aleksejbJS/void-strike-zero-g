// A friend's connection to a browser-hosted game over WebRTC (PeerJS public broker,
// spec phase 2 decision P1). Looks like a socket to ClientSession.

import Peer, { DataConnection } from 'peerjs';
import { EmitterSocket, isWireMessage } from './sessionSocket';

/** Human-readable reason for a PeerJS failure. */
export const describePeerError = (err: { type?: string; message?: string }): string => {
    switch (err.type) {
        case 'peer-unavailable': return 'game not found — the host may have closed it';
        case 'network':
        case 'server-error':
        case 'socket-error': return 'cannot reach the connection broker (check your internet)';
        case 'browser-incompatible': return 'this browser does not support peer-to-peer games';
        default: return err.message || String(err.type ?? 'unknown error');
    }
};

export class PeerSocket extends EmitterSocket {
    private readonly peer: Peer;
    private conn: DataConnection | null = null;

    constructor(hostPeerId: string, createPeer: () => Peer = () => new Peer()) {
        super();
        this.peer = createPeer();
        this.peer.on('open', () => this.connectTo(hostPeerId));
        this.peer.on('error', err => this.dispatch('connect_error', new Error(describePeerError(err))));
    }

    emit(event: string, data?: unknown) {
        if (this.conn?.open) this.conn.send({ event, data });
    }

    disconnect() {
        this.conn?.close();
        this.peer.destroy();
    }

    private connectTo(hostPeerId: string) {
        const conn = this.peer.connect(hostPeerId, { reliable: true, serialization: 'json' });
        this.conn = conn;
        conn.on('open', () => this.dispatch('connect'));
        conn.on('data', msg => { if (isWireMessage(msg)) this.dispatch(msg.event, msg.data); });
        conn.on('close', () => this.dispatch('disconnect'));
        conn.on('error', err => this.dispatch('connect_error', err instanceof Error ? err : new Error(String(err))));
    }
}
