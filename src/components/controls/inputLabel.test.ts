import { describe, it, expect } from 'vitest';
import { t } from '../hud/hudTestKit';
import { inputLabel } from './inputLabel';

describe('inputLabel', () => {
    it('names keys the way they are printed on the keyboard', () => {
        expect(inputLabel('KeyE', t)).toBe('E');
        expect(inputLabel('Digit0', t)).toBe('0');
        expect(inputLabel('Numpad0', t)).toBe('Num 0');
        expect(inputLabel('Space', t)).toBe('Space');
        expect(inputLabel('Shift', t)).toBe('Shift');
        expect(inputLabel('Control', t)).toBe('Ctrl');
        expect(inputLabel('Alt', t)).toBe('Alt');
        expect(inputLabel('ArrowUp', t)).toBe('↑');
        expect(inputLabel('ArrowLeft', t)).toBe('←');
    });

    it('names mouse buttons', () => {
        expect(inputLabel('Mouse0', t)).toBe('LMB');
        expect(inputLabel('Mouse1', t)).toBe('MMB');
        expect(inputLabel('Mouse2', t)).toBe('RMB');
        expect(inputLabel('Mouse4', t)).toBe('Mouse 5');
    });

    it('shows any other key by its code', () => {
        expect(inputLabel('F5', t)).toBe('F5');
        expect(inputLabel('Backquote', t)).toBe('Backquote');
    });
});
