import { describe, expect, it } from 'vitest';
import { DEFAULT_BUILD } from './buildParts';
import { migrateCharacter, migrateRobotDefaults, sameBuild } from './characterMigration';

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

describe('migrateRobotDefaults', () => {
    const legacy = { head: '#D9CDA8', torso: '#d9cda8', arms: '#b65842', legs: '#6B716A', jetpack: '#ef4444' };
    const cream = '#ead9ba';

    it('moves every old robot default to the 3D-kit cream, ignoring letter case', () => {
        expect(migrateRobotDefaults(legacy, 'robot')).toEqual({ head: cream, torso: cream, arms: cream, legs: cream, jetpack: '#ef4444' });
    });

    it('keeps a colour the player chose while migrating the untouched ones', () => {
        expect(migrateRobotDefaults({ ...legacy, arms: '#3b82f6' }, 'robot')).toMatchObject({ arms: '#3b82f6', head: cream, legs: cream });
    });

    it('leaves every other body alone', () => {
        expect(migrateRobotDefaults(legacy, 'human')).toEqual(legacy);
        expect(migrateRobotDefaults(legacy, undefined)).toEqual(legacy);
    });

    it('runs inside migrateCharacter for a robot that already has its body', () => {
        const build = { ...DEFAULT_BUILD, body: 'robot' as const };
        expect(migrateCharacter('base-robot', build, legacy).colors).toMatchObject({ head: cream, arms: cream, legs: cream });
    });
});
