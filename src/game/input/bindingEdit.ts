// Editing rules for the bindings: one input drives one action, so a key taken by another action moves.
// Pure functions: every edit returns new bindings.

import { BIND_ACTIONS, BindAction, Bindings, BindingSlots, InputCode, Slot } from './bindings';

export interface FreedSlot { action: BindAction; slot: Slot }

const withSlot = (slots: BindingSlots, slot: Slot, code: InputCode | null): BindingSlots =>
    slot === 0 ? [code, slots[1]] : [slots[0], code];

/** Put `code` into the slot. Wherever else it was is emptied; a slot of *another* action emptied that way is `freed`. */
export function assignBinding(b: Bindings, action: BindAction, slot: Slot, code: InputCode): { bindings: Bindings; freed: FreedSlot | null } {
    const next: Record<BindAction, BindingSlots> = { ...b };
    let freed: FreedSlot | null = null;
    for (const other of BIND_ACTIONS) {
        ([0, 1] as const).forEach(s => {
            if (next[other][s] !== code || (other === action && s === slot)) return;
            next[other] = withSlot(next[other], s, null);
            if (other !== action) freed = { action: other, slot: s };
        });
    }
    next[action] = withSlot(next[action], slot, code);
    return { bindings: next, freed };
}

export const clearBinding = (b: Bindings, action: BindAction, slot: Slot): Bindings =>
    ({ ...b, [action]: withSlot(b[action], slot, null) });

/** Actions the player can no longer perform: both slots empty. */
export const unboundActions = (b: Bindings): BindAction[] =>
    BIND_ACTIONS.filter(a => b[a][0] === null && b[a][1] === null);
