// Game Event Bus — decouples physics from UI (sound, kill feed, etc.)

export type GameEvent =
    | { type: 'KILL'; killer: string; killerColor: string; weapon: string; victim: string; victimColor: string }
    | { type: 'SOUND'; sound: string; subtype?: string }
    | { type: 'FLOAT_TEXT'; x: number; y: number; text: string; color: string };

type Listener = (event: GameEvent) => void;

class GameEventBus {
    private listeners: Listener[] = [];

    emit(event: GameEvent): void {
        for (const listener of this.listeners) {
            listener(event);
        }
    }

    on(cb: Listener): () => void {
        this.listeners.push(cb);
        return () => {
            this.listeners = this.listeners.filter(l => l !== cb);
        };
    }

    clear(): void {
        this.listeners = [];
    }
}

export const gameEvents = new GameEventBus();
