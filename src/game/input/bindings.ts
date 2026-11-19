// Key bindings: which physical keys / mouse buttons drive each player action.
// The match turns a bound input into the *standard* input the game always used (KeyA, KeyW, fire, hook…),
// so prediction, the network message and the server never see a player's own layout.

export type BindAction = 'left' | 'right' | 'jetpack' | 'down' | 'prone' | 'fire' | 'grapple';

/** Display order in the profile. */
export const BIND_ACTIONS: readonly BindAction[] = ['left', 'right', 'jetpack', 'down', 'prone', 'fire', 'grapple'];

/** A normalized `KeyboardEvent.code` ('KeyE', 'Space', 'Shift') or a mouse button 'Mouse0'…'Mouse4'. */
export type InputCode = string;

/** 0 = primary, 1 = secondary. */
export type Slot = 0 | 1;

export type BindingSlots = readonly [InputCode | null, InputCode | null];
export type Bindings = Readonly<Record<BindAction, BindingSlots>>;

/** The standard input an action produces: a key the simulation reads, or the fire / hook buttons. */
export type ActionTarget = 'KeyA' | 'KeyD' | 'KeyW' | 'KeyS' | 'KeyZ' | 'fire' | 'hook';

export const ACTION_TARGET: Readonly<Record<BindAction, ActionTarget>> = {
    left: 'KeyA',
    right: 'KeyD',
    jetpack: 'KeyW',
    down: 'KeyS',
    prone: 'KeyZ',
    fire: 'fire',
    grapple: 'hook',
};

export const DEFAULT_BINDINGS: Bindings = {
    left: ['KeyA', null],
    right: ['KeyD', null],
    jetpack: ['KeyW', 'Space'],
    down: ['KeyS', null],
    prone: ['KeyZ', null],
    fire: ['Mouse0', null],
    grapple: ['Mouse2', 'Shift'],
};

const SIDED_MODIFIER = /^(Shift|Control|Alt|Meta)(Left|Right)$/;

/** Left and right Shift / Ctrl / Alt / Cmd count as one key: players do not care which side they press. */
export const normalizeCode = (code: string): InputCode => code.replace(SIDED_MODIFIER, '$1');

const MOUSE_BUTTONS = 5;

/** `MouseEvent.button` 0…4 → 'Mouse0'…'Mouse4'; anything else is not bindable. */
export const mouseCode = (button: number): InputCode | null =>
    Number.isInteger(button) && button >= 0 && button < MOUSE_BUTTONS ? `Mouse${button}` : null;

// Esc pauses, F3 is the debug panel, digits pick weapons (by `e.key`, so the numpad too), Cmd starts browser shortcuts
const RESERVED = new Set(['Escape', 'F3', 'Meta']);
const WEAPON_DIGIT = /^(Digit|Numpad)[1-9]$/;

export const isReserved = (code: InputCode): boolean => RESERVED.has(code) || WEAPON_DIGIT.test(code);
