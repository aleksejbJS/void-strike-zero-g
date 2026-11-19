// Match input through the player's bindings: physical key / mouse button → action → the standard input the
// game reads. Raw physical codes never reach the game's input state.

import { ACTION_TARGET, ActionTarget, BIND_ACTIONS, BindAction, Bindings, InputCode } from './bindings';

export interface ActionChange { target: ActionTarget; active: boolean }

export interface BindingInput {
    /** A key or button went down (already normalized). Returns the action that switched on, if any. */
    press(code: InputCode): ActionChange | null;
    /** A key or button went up. Returns the action that switched off, if any. */
    release(code: InputCode): ActionChange | null;
    /** Forget everything held (the window lost focus). */
    reset(): void;
    /** Whether an action uses this input: the match then keeps the browser from acting on it (Tab, F5, Space…). */
    isBound(code: InputCode): boolean;
}

type KeyTarget = Exclude<ActionTarget, 'fire' | 'hook'>;

export interface InputSink {
    setKey(code: KeyTarget, down: boolean): void;
    setFire(down: boolean): void;
    setHook(down: boolean): void;
}

export function createBindingInput(bindings: Bindings): BindingInput {
    const actionOf = new Map<InputCode, BindAction>();
    for (const action of BIND_ACTIONS) {
        for (const code of bindings[action]) if (code !== null) actionOf.set(code, action);
    }
    const held = new Set<InputCode>();
    const isActive = (action: BindAction) => bindings[action].some(code => code !== null && held.has(code));

    // Applies `change` to the held set and reports the action only when its on/off state flips
    const update = (code: InputCode, down: boolean): ActionChange | null => {
        const action = actionOf.get(code);
        if (!action || held.has(code) === down) return null;
        const before = isActive(action);
        if (down) held.add(code); else held.delete(code);
        const after = isActive(action);
        return before === after ? null : { target: ACTION_TARGET[action], active: after };
    };

    return {
        press: code => update(code, true),
        release: code => update(code, false),
        reset: () => held.clear(),
        isBound: code => actionOf.has(code),
    };
}

export function applyActionChange(change: ActionChange | null, sink: InputSink): void {
    if (!change) return;
    if (change.target === 'fire') sink.setFire(change.active);
    else if (change.target === 'hook') sink.setHook(change.active);
    else sink.setKey(change.target, change.active);
}
