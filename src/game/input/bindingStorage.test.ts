import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DEFAULT_BINDINGS } from './bindings';
import { BINDINGS_STORAGE_KEY, loadBindings, onBindingsChange, sanitizeBindings, saveBindings } from './bindingStorage';
import { installMemoryStorage } from '../../test/memoryStorage';

describe('bindingStorage', () => {
    let warn: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
        installMemoryStorage();
        warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => warn.mockRestore());

    it('gives the defaults when nothing is stored, without a warning', () => {
        expect(loadBindings()).toEqual(DEFAULT_BINDINGS);
        expect(warn).not.toHaveBeenCalled();
    });

    it('loads back what was saved', () => {
        const custom = { ...DEFAULT_BINDINGS, jetpack: ['KeyE', null] as const };
        saveBindings(custom);
        expect(JSON.parse(localStorage.getItem(BINDINGS_STORAGE_KEY) as string)).toEqual({ v: 1, bindings: custom });
        expect(loadBindings()).toEqual(custom);
    });

    it('tells listeners about every save until they unsubscribe', () => {
        const listener = vi.fn();
        const off = onBindingsChange(listener);
        saveBindings(DEFAULT_BINDINGS);
        expect(listener).toHaveBeenCalledTimes(1);
        off();
        saveBindings(DEFAULT_BINDINGS);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('falls back to the defaults with a warning when the stored text is broken', () => {
        localStorage.setItem(BINDINGS_STORAGE_KEY, '{oops');
        expect(loadBindings()).toEqual(DEFAULT_BINDINGS);
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('falls back to the defaults with a warning for an unknown format version', () => {
        localStorage.setItem(BINDINGS_STORAGE_KEY, JSON.stringify({ v: 2, bindings: {} }));
        expect(loadBindings()).toEqual(DEFAULT_BINDINGS);
        expect(warn).toHaveBeenCalledTimes(1);
    });
});

describe('sanitizeBindings', () => {
    it('drops reserved keys and junk, normalizes modifier sides', () => {
        const b = sanitizeBindings({ ...DEFAULT_BINDINGS, jetpack: ['Digit1', 'Escape'], down: ['<script>', 'ShiftRight'], prone: ['ControlLeft', null], grapple: ['Mouse2', null] });
        expect(b.jetpack).toEqual([null, null]);
        expect(b.down).toEqual([null, 'Shift']);
        expect(b.prone).toEqual([null, null]);
    });

    it('keeps a duplicated input only on the earlier action', () => {
        const b = sanitizeBindings({ ...DEFAULT_BINDINGS, jetpack: ['KeyE', null], fire: ['KeyE', 'Mouse0'] });
        expect(b.jetpack).toEqual(['KeyE', null]);
        expect(b.fire).toEqual([null, 'Mouse0']);
    });

    it('ignores actions this build does not know', () => {
        const b = sanitizeBindings({ ...DEFAULT_BINDINGS, jump: ['Space', null] });
        expect(b).toEqual(DEFAULT_BINDINGS);
        expect('jump' in b).toBe(false);
    });

    it('gives a missing action its defaults, minus inputs the player already uses', () => {
        const { prone: _gone, ...stored } = { ...DEFAULT_BINDINGS, fire: ['KeyZ', null] };
        const b = sanitizeBindings(stored);
        expect(b.fire).toEqual(['KeyZ', null]);
        expect(b.prone).toEqual([null, null]);
    });

    it('empties an action whose value is malformed', () => {
        expect(sanitizeBindings({ ...DEFAULT_BINDINGS, left: 'KeyA' }).left).toEqual([null, null]);
        expect(sanitizeBindings({ ...DEFAULT_BINDINGS, left: [1, 2] }).left).toEqual([null, null]);
    });

    it('turns anything that is not an object into the defaults', () => {
        expect(sanitizeBindings(null)).toEqual(DEFAULT_BINDINGS);
        expect(sanitizeBindings([1])).toEqual(DEFAULT_BINDINGS);
    });
});
