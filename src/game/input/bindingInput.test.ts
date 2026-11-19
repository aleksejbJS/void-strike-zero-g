import { describe, it, expect, vi } from 'vitest';
import { Bindings, DEFAULT_BINDINGS, normalizeCode } from './bindings';
import { applyActionChange, createBindingInput, InputSink } from './bindingInput';

describe('createBindingInput', () => {
    it('turns a default key into its own standard input', () => {
        const input = createBindingInput(DEFAULT_BINDINGS);
        expect(input.press('KeyA')).toEqual({ target: 'KeyA', active: true });
        expect(input.press('KeyA')).toBeNull(); // key repeat while held
        expect(input.release('KeyA')).toEqual({ target: 'KeyA', active: false });
    });

    it('turns a remapped key into the standard input of its action', () => {
        const custom: Bindings = { ...DEFAULT_BINDINGS, jetpack: ['KeyE', null], left: ['KeyW', null] };
        const input = createBindingInput(custom);
        expect(input.press('KeyE')).toEqual({ target: 'KeyW', active: true });
        expect(input.press('KeyW')).toEqual({ target: 'KeyA', active: true });
    });

    it('keeps an action on while any of its inputs is still held', () => {
        const input = createBindingInput({ ...DEFAULT_BINDINGS, jetpack: ['KeyW', 'KeyE'] });
        expect(input.press('KeyW')).toEqual({ target: 'KeyW', active: true });
        expect(input.press('KeyE')).toBeNull();
        expect(input.release('KeyW')).toBeNull();
        expect(input.release('KeyE')).toEqual({ target: 'KeyW', active: false });
    });

    it('Space is the jump, sent as the standard Space key', () => {
        expect(createBindingInput(DEFAULT_BINDINGS).press('Space')).toEqual({ target: 'Space', active: true });
    });

    it('maps mouse buttons and either Shift to fire and hook', () => {
        const input = createBindingInput(DEFAULT_BINDINGS);
        expect(input.press('Mouse0')).toEqual({ target: 'fire', active: true });
        expect(input.press(normalizeCode('ShiftRight'))).toEqual({ target: 'hook', active: true });
    });

    it('ignores inputs no action uses', () => {
        const input = createBindingInput(DEFAULT_BINDINGS);
        expect(input.press('KeyQ')).toBeNull();
        expect(input.release('KeyQ')).toBeNull();
    });

    it('forgets every held input on reset (window lost focus)', () => {
        const input = createBindingInput(DEFAULT_BINDINGS);
        input.press('KeyW');
        input.reset();
        expect(input.press('KeyW')).toEqual({ target: 'KeyW', active: true });
    });
});

describe('isBound', () => {
    it('tells which inputs drive an action, so the match can keep the browser from acting on them', () => {
        const input = createBindingInput({ ...DEFAULT_BINDINGS, jetpack: ['Tab', null] });
        expect(input.isBound('Tab')).toBe(true);
        expect(input.isBound('Mouse2')).toBe(true);
        expect(input.isBound('KeyW')).toBe(false);
        expect(input.isBound('F5')).toBe(false);
    });
});

describe('applyActionChange', () => {
    const sink = (): InputSink & { [k: string]: ReturnType<typeof vi.fn> } => ({ setKey: vi.fn(), setFire: vi.fn(), setHook: vi.fn() });

    it('sends each change to the matching setter', () => {
        const s = sink();
        applyActionChange({ target: 'KeyD', active: true }, s);
        applyActionChange({ target: 'fire', active: false }, s);
        applyActionChange({ target: 'hook', active: true }, s);
        expect(s.setKey).toHaveBeenCalledWith('KeyD', true);
        expect(s.setFire).toHaveBeenCalledWith(false);
        expect(s.setHook).toHaveBeenCalledWith(true);
    });

    it('does nothing without a change', () => {
        const s = sink();
        applyActionChange(null, s);
        expect(s.setKey).not.toHaveBeenCalled();
        expect(s.setFire).not.toHaveBeenCalled();
        expect(s.setHook).not.toHaveBeenCalled();
    });
});
