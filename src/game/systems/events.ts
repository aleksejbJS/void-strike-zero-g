// Game Event Bus — decouples physics from UI (sound, kill feed, etc.)

export type EffectKind = 'blood' | 'spark' | 'explosion' | 'shell' | 'respawn';

export type GameEvent =
    | { type: 'KILL'; killer: string; killerColor: string; weapon: string; victim: string; victimColor: string }
    | { type: 'SOUND'; sound: string; subtype?: string }
    | { type: 'FLOAT_TEXT'; x: number; y: number; text: string; color: string }
    // Cosmetic effects at a position — see effects.ts
    | { type: 'EFFECT'; effect: EffectKind; x: number; y: number; color?: string; count?: number }
    | { type: 'DAMAGE'; x: number; y: number; amount: number }
    | { type: 'DEATH'; x: number; y: number; color: string; height: number; parts?: RagdollColors };

/** Colors of the body parts that fly apart on death. */
export interface RagdollColors { head: string; torso: string; arm: string; leg: string }

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
