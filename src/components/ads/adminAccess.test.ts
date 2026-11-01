import { describe, it, expect, beforeEach } from 'vitest';
import { rememberAdminFlag } from './adminAccess';

describe('ad settings access', () => {
    beforeEach(() => localStorage.clear());

    it('remembers ?admin=1 in this browser and forgets it with ?admin=0', () => {
        rememberAdminFlag('?admin=1');
        expect(localStorage.getItem('void-strike.admin')).toBe('1');
        rememberAdminFlag('?mode=ctf');
        expect(localStorage.getItem('void-strike.admin')).toBe('1');
        rememberAdminFlag('?admin=0');
        expect(localStorage.getItem('void-strike.admin')).toBeNull();
    });
});
