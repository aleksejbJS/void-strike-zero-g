import Peer, { DataConnection } from 'peerjs';
import { GameState, NetworkMode, NetworkPacket, PlayerInput } from '../../types';

export class NetworkManager {
    private peer: Peer | null = null;
    private connections: Map<string, DataConnection> = new Map();
    private mode: NetworkMode = NetworkMode.OFFLINE;
    private myId: string = '';

    // Callbacks
    public onStateUpdate: ((state: GameState) => void) | null = null;
    public onInput: ((playerId: string, input: PlayerInput) => void) | null = null;
    public onPlayerJoin: ((id: string, name: string, color: string, skinId: string) => void) | null = null;
    public onPlayerLeave: ((id: string) => void) | null = null;

    constructor() { }

    public async initialize(mode: NetworkMode, hostId?: string): Promise<string> {
        this.mode = mode;

        return new Promise((resolve, reject) => {
            this.peer = new Peer();

            this.peer.on('open', (id) => {
                this.myId = id;
                console.log('PeerJS ID:', id);

                if (mode === NetworkMode.CLIENT && hostId) {
                    this.connectToHost(hostId);
                }
                resolve(id);
            });

            this.peer.on('connection', (conn) => {
                this.handleConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error('PeerJS Error:', err);
                reject(err);
            });
        });
    }

    private connectToHost(hostId: string) {
        if (!this.peer) return;
        const conn = this.peer.connect(hostId);
        this.handleConnection(conn);
    }

    private handleConnection(conn: DataConnection) {
        conn.on('open', () => {
            console.log('Connected to:', conn.peer);
            this.connections.set(conn.peer, conn);

            // If we are client, send handshake immediately? 
            // Actually, let the GameCanvas handle sending the handshake packet after init
        });

        conn.on('data', (data: any) => {
            const packet = data as NetworkPacket;
            this.handlePacket(packet, conn.peer);
        });

        conn.on('close', () => {
            console.log('Connection closed:', conn.peer);
            this.connections.delete(conn.peer);
            if (this.onPlayerLeave) this.onPlayerLeave(conn.peer);
        });
    }

    private handlePacket(packet: NetworkPacket, senderId: string) {
        switch (packet.type) {
            case 'HANDSHAKE':
                if (this.onPlayerJoin) {
                    this.onPlayerJoin(packet.playerId || senderId, packet.name, packet.color, packet.skinId);
                }
                break;
            case 'STATE_UPDATE':
                if (this.onStateUpdate) {
                    this.onStateUpdate(packet.state);
                }
                break;
            case 'INPUT':
                if (this.onInput) {
                    this.onInput(packet.playerId || senderId, packet.input);
                }
                break;
        }
    }

    public send(packet: NetworkPacket) {
        this.connections.forEach(conn => {
            if (conn.open) conn.send(packet);
        });
    }

    public sendTo(peerId: string, packet: NetworkPacket) {
        const conn = this.connections.get(peerId);
        if (conn && conn.open) {
            conn.send(packet);
        }
    }

    public getMyId() {
        return this.myId;
    }

    public cleanup() {
        this.connections.forEach(c => c.close());
        this.connections.clear();
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
    }
}
