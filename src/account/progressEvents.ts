// A tiny module-level signal: "the player's saved progress changed" (match XP paid out, build saved).
// The game calls notifyProgressChanged without knowing about accounts; AccountProvider listens while
// someone is logged in and schedules a cloud push. With no listener it does nothing.

type Listener = () => void;

const listeners = new Set<Listener>();

export function notifyProgressChanged(): void {
    for (const listener of [...listeners]) {
        try {
            listener();
        } catch (error) {
            // One broken listener must not stop the others, nor the game code that called us.
            console.error('[account] progress listener failed:', error);
        }
    }
}

/** Returns the unsubscribe function. */
export function onProgressChanged(listener: Listener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
