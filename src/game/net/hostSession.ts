// Browser hosting (spec phase 2): the room runs in a Web Worker, friends connect over
// WebRTC (PeerJS), the host plays through a local socket with no network in between.
// This main-thread class only relays messages: WebRTC isn't reliably available in workers.

import Peer, { DataConnection } from 'peerjs';
import { RoomConfig } from './room';
import { ToWorker, FromWorker, LOCAL_LINK_ID } from './hostProtocol';
import { EmitterSocket, SessionSocket, isWireMessage } from './sessionSocket';
import { describePeerError } from './peerSocket';

// Host upload grows with every player (30 snapshots/s each)
export const BROWSER_HOST_MAX_PLAYERS = 6;

export interface HostCallbacks {
    /** The game can be joined: share `?host=<peerId>` */
    onInviteReady: (peerId: string) => void;
    onError: (message: string) => void;
}

/** The host's own player: messages go straight to the worker. */
class LocalSocket extends EmitterSocket {
    constructor(private readonly post: (msg: ToWorker) => void) {
        super();
        post({ kind: 'connect', linkId: LOCAL_LINK_ID });
        // Let the session attach its handlers first, like a real socket connecting
        setTimeout(() => this.dispatch('connect'), 0);
    }

    emit(event: string, data?: unknown) {
        this.post({ kind: 'message', linkId: LOCAL_LINK_ID, event, data });
    }

    disconnect() {
        this.post({ kind: 'disconnect', linkId: LOCAL_LINK_ID });
    }

    receive(event: string, data: unknown) {
        this.dispatch(event, data);
    }
}

export class HostSession {
    private readonly worker: Worker;
    private readonly peer: Peer;
    private readonly peers = new Map<string, DataConnection>();
    private readonly local: LocalSocket;

    constructor(config: RoomConfig, private readonly callbacks: HostCallbacks) {
        this.worker = new Worker(new URL('./hostWorker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = (e: MessageEvent<FromWorker>) => this.fromWorker(e.data);
        this.worker.onerror = e => callbacks.onError(`game host stopped: ${e.message}`);
        this.post({ kind: 'start', config });
        this.local = new LocalSocket(msg => this.post(msg));

        this.peer = new Peer();
        this.peer.on('open', id => callbacks.onInviteReady(id));
        this.peer.on('connection', conn => this.accept(conn));
        this.peer.on('error', err => callbacks.onError(describePeerError(err)));
    }

    /** Socket for the host's own player. */
    get localSocket(): SessionSocket {
        return this.local;
    }

    dispose() {
        this.peers.forEach(conn => conn.close());
        this.peers.clear();
        this.peer.destroy();
        this.worker.terminate();
    }

    private post(msg: ToWorker) {
        this.worker.postMessage(msg);
    }

    private accept(conn: DataConnection) {
        const linkId = conn.peer;
        conn.on('open', () => {
            this.peers.set(linkId, conn);
            this.post({ kind: 'connect', linkId });
        });
        conn.on('data', msg => {
            if (isWireMessage(msg)) this.post({ kind: 'message', linkId, event: msg.event, data: msg.data });
        });
        const drop = () => {
            if (this.peers.delete(linkId)) this.post({ kind: 'disconnect', linkId });
        };
        conn.on('close', drop);
        conn.on('error', err => {
            console.warn(`Connection to ${linkId} failed:`, err);
            drop();
        });
    }

    private fromWorker(msg: FromWorker) {
        if (msg.kind === 'error') {
            this.callbacks.onError(`game host error: ${msg.message}`);
            return;
        }
        if (msg.linkId === LOCAL_LINK_ID) this.local.receive(msg.event, msg.data);
        else this.peers.get(msg.linkId)?.send({ event: msg.event, data: msg.data });
    }
}
