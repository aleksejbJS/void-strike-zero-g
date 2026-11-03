import { describe, it, expect } from 'vitest';
import { hudHealth } from './hudHealth';

describe('hudHealth', () => {
    it('rounds to the nearest point for a fighter with both legs', () => {
        expect(hudHealth({ health: 73.4 })).toBe(73);
        expect(hudHealth({ health: 73.6 })).toBe(74);
    });

    it('rounds a bleeding fighter up: it reads 0 only when it has bled out', () => {
        const wound = { by: 'shooter' };
        expect(hudHealth({ health: 0.4, wound })).toBe(1);
        expect(hudHealth({ health: 9.01, wound })).toBe(10);
        expect(hudHealth({ health: 9, wound })).toBe(9);
        expect(hudHealth({ health: 0, wound })).toBe(0);
    });
});
