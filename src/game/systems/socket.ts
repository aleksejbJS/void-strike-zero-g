import { io, Socket } from 'socket.io-client';
import { GameState, PlayerInput } from '../../types';

export class SocketManager {
    private socket: Socket | null = null;
    public onStateUpdate: ((state: GameState) => void) | null = null;
    public onInit: ((data: { id: string, state: GameState }) => void) | null = null;

    constructor() { }

    public connect(url: string, playerData: { name: string, color: string, skinId: string, headColor: string, torsoColor: string, armColor: string, legColor: string, jetpackColor: string, mapId: string }) {
        this.socket = io(url);

        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.socket?.emit('join', playerData);
        });

        this.socket.on('init', (data: { id: string, state: GameState }) => {
            if (this.onInit) this.onInit(data);
        });

        this.socket.on('stateUpdate', (state: GameState) => {
            if (this.onStateUpdate) this.onStateUpdate(state);
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });
    }

    public sendInput(input: PlayerInput) {
        if (this.socket) {
            this.socket.emit('input', input);
        }
    }

    public disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
}
