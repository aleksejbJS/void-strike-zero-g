import { describe, it, expect } from 'vitest';
import { BIND_ACTIONS, DEFAULT_BINDINGS, isReserved, mouseCode, normalizeCode } from './bindings';

describe('normalizeCode', () => {
    it('treats the left and right modifier keys as one key', () => {
        expect(normalizeCode('ShiftRight')).toBe('Shift');
        expect(normalizeCode('ShiftLeft')).toBe('Shift');
        expect(normalizeCode('ControlLeft')).toBe('Control');
        expect(normalizeCode('AltRight')).toBe('Alt');
        expect(normalizeCode('MetaLeft')).toBe('Meta');
    });

    it('leaves every other key as it is', () => {
        expect(normalizeCode('KeyE')).toBe('KeyE');
        expect(normalizeCode('Space')).toBe('Space');
    });
});

describe('mouseCode', () => {
    it('names the five mouse buttons and nothing else', () => {
        expect(mouseCode(0)).toBe('Mouse0');
        expect(mouseCode(2)).toBe('Mouse2');
        expect(mouseCode(4)).toBe('Mouse4');
        expect(mouseCode(5)).toBeNull();
        expect(mouseCode(-1)).toBeNull();
    });
});

describe('isReserved', () => {
    it('keeps the game keys out of reach: Esc, F3, weapon digits, Cmd and Ctrl (Ctrl+W closes the tab)', () => {
        for (const code of ['Escape', 'F3', 'Digit1', 'Digit9', 'Numpad1', 'Numpad5', 'Numpad9', 'Meta', 'Control']) {
            expect(isReserved(code)).toBe(true);
        }
    });

    it('lets ordinary keys and mouse buttons through', () => {
        for (const code of ['Digit0', 'Numpad0', 'KeyE', 'Shift', 'Mouse0', 'F4']) {
            expect(isReserved(code)).toBe(false);
        }
    });
});

describe('DEFAULT_BINDINGS', () => {
    it('match the controls the game always had', () => {
        expect(DEFAULT_BINDINGS.left).toEqual(['KeyA', null]);
        expect(DEFAULT_BINDINGS.right).toEqual(['KeyD', null]);
        expect(DEFAULT_BINDINGS.jetpack).toEqual(['KeyW', 'Space']);
        expect(DEFAULT_BINDINGS.down).toEqual(['KeyS', null]);
        expect(DEFAULT_BINDINGS.prone).toEqual(['KeyZ', null]);
        expect(DEFAULT_BINDINGS.fire).toEqual(['Mouse0', null]);
        expect(DEFAULT_BINDINGS.grapple).toEqual(['Mouse2', 'Shift']);
    });

    it('use every input at most once and nothing reserved', () => {
        const codes = BIND_ACTIONS.flatMap(a => DEFAULT_BINDINGS[a]).filter((c): c is string => c !== null);
        expect(new Set(codes).size).toBe(codes.length);
        expect(codes.some(isReserved)).toBe(false);
    });

    it('list the actions in the order the profile shows them', () => {
        expect(BIND_ACTIONS).toEqual(['left', 'right', 'jetpack', 'down', 'prone', 'fire', 'grapple']);
    });
});
