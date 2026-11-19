// Keeps a quick tap alive until a simulation tick has seen it. The jump fires on a fresh press, and at a low
// frame rate a key can go down and up between two ticks: read as plain "held", that press would be lost.

export interface PressLatch {
    down(): void;
    up(): void;
    /** What the next tick should read: held now, or tapped since the last tick. */
    held(): boolean;
    /** A tick has read the input. */
    ticked(): void;
    reset(): void;
}

export function createPressLatch(): PressLatch {
    let physical = false;
    let pending = false;
    return {
        down: () => { physical = true; pending = true; },
        up: () => { physical = false; },
        held: () => physical || pending,
        ticked: () => { pending = false; },
        reset: () => { physical = false; pending = false; },
    };
}
