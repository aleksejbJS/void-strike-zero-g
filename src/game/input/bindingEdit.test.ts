import { describe, it, expect } from 'vitest';
import { DEFAULT_BINDINGS } from './bindings';
import { assignBinding, clearBinding, unboundActions } from './bindingEdit';

describe('assignBinding', () => {
    it('puts a free key into the slot and leaves the input untouched', () => {
        const before = JSON.stringify(DEFAULT_BINDINGS);
        const { bindings, freed } = assignBinding(DEFAULT_BINDINGS, 'jetpack', 0, 'KeyE');
        expect(bindings.jetpack).toEqual(['KeyE', null]);
        expect(freed).toBeNull();
        expect(JSON.stringify(DEFAULT_BINDINGS)).toBe(before);
    });

    it('moves a key taken by another action and reports the slot it left empty', () => {
        const { bindings, freed } = assignBinding(DEFAULT_BINDINGS, 'right', 0, 'KeyA');
        expect(bindings.right).toEqual(['KeyA', null]);
        expect(bindings.left).toEqual([null, null]);
        expect(freed).toEqual({ action: 'left', slot: 0 });
        expect(unboundActions(bindings)).toEqual(['left']);
    });

    it('moves a key between the two slots of one action without reporting a conflict', () => {
        const { bindings, freed } = assignBinding(DEFAULT_BINDINGS, 'jetpack', 1, 'KeyW');
        expect(bindings.jetpack).toEqual([null, 'KeyW']);
        expect(bindings.jump).toEqual(['Space', null]);
        expect(freed).toBeNull();
    });

    it('re-binding the key a slot already has changes nothing', () => {
        const { bindings, freed } = assignBinding(DEFAULT_BINDINGS, 'jetpack', 0, 'KeyW');
        expect(bindings).toEqual(DEFAULT_BINDINGS);
        expect(freed).toBeNull();
    });
});

describe('clearBinding', () => {
    it('empties one slot', () => {
        expect(clearBinding(DEFAULT_BINDINGS, 'grapple', 1).grapple).toEqual(['Mouse2', null]);
    });
});

describe('unboundActions', () => {
    it('is empty for the defaults', () => {
        expect(unboundActions(DEFAULT_BINDINGS)).toEqual([]);
    });
});
