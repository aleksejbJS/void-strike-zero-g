import { describe, it, expect } from 'vitest';
import { DEFAULT_BUILD, FighterBuild } from './buildParts';
import { sanitizeBuild } from './sanitizeBuild';

const valid: FighterBuild = {
    helmet: 'dome', visor: 'glass', ears: 'wolf', tail: 'lizard', jetpack: 'rocket', flame: 'blue',
    pattern: 'camo', badge: 'number', badgeNumber: 42, emblem: 'star',
    visorColor: '#112233', patternColor: '#abcdef',
};

describe('sanitizeBuild', () => {
    it('keeps each illustrated body identity and free face choices', () => {
        for (const body of ['human', 'human-female', 'robot', 'toxic', 'cat']) {
            expect(sanitizeBuild({ ...valid, body, helmet: 'none', visor: 'none' }))
                .toMatchObject({ body, helmet: 'none', visor: 'none' });
        }
    });

    it('rejects unknown body identities without adding a field to legacy builds', () => {
        expect(sanitizeBuild({ ...valid, body: 'dragon' })).toEqual(valid);
        expect(sanitizeBuild({ ...valid, body: null })).toEqual(valid);
        expect(sanitizeBuild({ ...valid, body: 'dragon' }, { ...valid, body: 'cat' } as FighterBuild))
            .toHaveProperty('body', 'cat');
    });

    it('keeps a valid build', () => {
        expect(sanitizeBuild(valid)).toEqual(valid);
    });

    it('replaces unknown ids slot by slot', () => {
        const result = sanitizeBuild({ ...valid, ears: 'laser', tail: 42 });
        expect(result.ears).toBe(DEFAULT_BUILD.ears);
        expect(result.tail).toBe(DEFAULT_BUILD.tail);
        expect(result).toMatchObject({ helmet: 'dome', visor: 'glass', jetpack: 'rocket', flame: 'blue', pattern: 'camo' });
    });

    it('uses the given fallback for bad slots', () => {
        const fallback: FighterBuild = { ...DEFAULT_BUILD, ears: 'bunny', emblem: 'bolt' };
        const result = sanitizeBuild({ ...valid, ears: 'laser', emblem: null }, fallback);
        expect(result.ears).toBe('bunny');
        expect(result.emblem).toBe('bolt');
    });

    it('fills missing fields from the fallback', () => {
        expect(sanitizeBuild({ helmet: 'box' })).toEqual({ ...DEFAULT_BUILD, helmet: 'box' });
    });

    it('clamps the badge number to 0..99 integers', () => {
        expect(sanitizeBuild({ ...valid, badgeNumber: 1e9 }).badgeNumber).toBe(99);
        expect(sanitizeBuild({ ...valid, badgeNumber: -5 }).badgeNumber).toBe(0);
        expect(sanitizeBuild({ ...valid, badgeNumber: 3.7 }).badgeNumber).toBe(3);
        expect(sanitizeBuild({ ...valid, badgeNumber: 'x' }).badgeNumber).toBe(DEFAULT_BUILD.badgeNumber);
        expect(sanitizeBuild({ ...valid, badgeNumber: NaN }).badgeNumber).toBe(DEFAULT_BUILD.badgeNumber);
    });

    it('rejects bad colours', () => {
        const result = sanitizeBuild({ ...valid, visorColor: 'red; x', patternColor: '#fff' });
        expect(result.visorColor).toBe(DEFAULT_BUILD.visorColor);
        expect(result.patternColor).toBe(DEFAULT_BUILD.patternColor);
    });

    it('returns the fallback for non-objects', () => {
        for (const raw of [null, undefined, 'x', 5, []]) {
            expect(sanitizeBuild(raw)).toEqual(DEFAULT_BUILD);
        }
        expect(sanitizeBuild(null, valid)).toEqual(valid);
    });

    it('never returns the fallback object itself', () => {
        expect(sanitizeBuild(null, valid)).not.toBe(valid);
    });
});
