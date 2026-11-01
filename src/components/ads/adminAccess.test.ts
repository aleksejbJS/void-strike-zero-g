import { describe, it, expect, beforeEach, Mock } from 'vitest';
import { rememberAdminFlag } from './adminAccess';

describe('ad settings access', () => {
    // The test setup replaces localStorage with empty mocks: back them with a plain object
    let store: Record<string, string>;
    beforeEach(() => {
        store = {};
        (localStorage.getItem as Mock).mockImplementation((k: string) => store[k] ?? null);
        (localStorage.setItem as Mock).mockImplementation((k: string, v: string) => { store[k] = v; });
        (localStorage.removeItem as Mock).mockImplementation((k: string) => { delete store[k]; });
    });

    it('remembers ?admin=1 in this browser and forgets it with ?admin=0', () => {
        rememberAdminFlag('?admin=1');
        expect(store['void-strike.admin']).toBe('1');
        rememberAdminFlag('?mode=ctf');
        expect(store['void-strike.admin']).toBe('1');
        rememberAdminFlag('?admin=0');
        expect(store['void-strike.admin']).toBeUndefined();
    });
});
