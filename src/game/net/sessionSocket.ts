// The minimal socket shape ClientSession needs. A socket.io client socket already
// matches it; WebRTC peers and the browser host's own player get small adapters.
// Lifecycle events every implementation emits: 'connect', 'connect_error' (Error), 'disconnect'.

export interface SessionSocket {
    emit(event: string, data?: unknown): void;
    on(event: string, handler: (data: any) => void): void;
    removeAllListeners(): void;
    disconnect(): void;
}

/** What travels over a WebRTC data channel: a named message, like socket.io's emit. */
export interface WireMessage {
    event: string;
    data: unknown;
}

export const isWireMessage = (msg: unknown): msg is WireMessage =>
    typeof msg === 'object' && msg !== null && typeof (msg as WireMessage).event === 'string';

/** Base for adapters: keeps handlers and dispatches incoming messages to them. */
export abstract class EmitterSocket implements SessionSocket {
    private handlers = new Map<string, ((data: any) => void)[]>();

    on(event: string, handler: (data: any) => void) {
        this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
    }

    removeAllListeners() {
        this.handlers.clear();
    }

    abstract emit(event: string, data?: unknown): void;
    abstract disconnect(): void;

    protected dispatch(event: string, data?: unknown) {
        this.handlers.get(event)?.forEach(h => h(data));
    }
}
