import { describe, expect, it } from 'vitest';
import { DEFAULT_BUILD } from './buildParts';
import { migrateCharacter, sameBuild } from './characterMigration';

describe('sameBuild', () => {
    it('compares an added or removed body identity in either direction', () => {
        const illustrated = { ...DEFAULT_BUILD, body: 'human' as const };
        expect(sameBuild(DEFAULT_BUILD, illustrated)).toBe(false);
        expect(sameBuild(illustrated, DEFAULT_BUILD)).toBe(false);
        expect(sameBuild(illustrated, { ...illustrated })).toBe(true);
    });
});

describe('migrateCharacter', () => {
    it('does not infer that a blue head is a fallback without explicit origin information', () => {
        const colors = { head: '#3b82f6', torso: '#3b82f6', arms: '#3b82f6', legs: '#475569', jetpack: '#ef4444' };
        expect(migrateCharacter('classic', DEFAULT_BUILD, colors).colors.head).toBe('#3b82f6');
    });
});
