import { describe, it, expect } from 'vitest';
import { validateJoin, validateInput } from './validation';
import { MAX_NAME_LENGTH } from './protocol';
import { DEFAULT_BUILD, EARS, HELMETS, TAILS } from '../build/buildParts';

const goodBuild = { ...DEFAULT_BUILD, helmet: 'dome', ears: 'horns', tail: 'lizard', badge: 'number', badgeNumber: 42 } as const;
const goodJoin = { name: 'Alex', color: '#ff0000', headColor: '#00ff00', torsoColor: '#0000ff', armColor: '#111111', legColor: '#222222', jetpackColor: '#333333', skinId: 'classic', build: goodBuild };
const goodInput = { keys: { KeyA: true }, mouse: { x: 10, y: 20 }, mousePressed: false, hookPressed: true, sequence: 5, timestamp: 1 };

describe('validateJoin', () => {
    it.each([undefined, null, 42, 'join', [], {}, { name: '' }, { name: '   ' }, { name: 123 }])('rejects %j', raw => {
        expect(validateJoin(raw)).toBeNull();
    });

    it('accepts a normal request', () => {
        expect(validateJoin(goodJoin)).toEqual(goodJoin);
    });

    it('caps the name length and strips control characters', () => {
        const res = validateJoin({ ...goodJoin, name: '\u0007' + 'x'.repeat(1_000_000) });
        expect(res!.name).toBe('x'.repeat(MAX_NAME_LENGTH));
    });

    it('replaces bad colors and unknown skins with defaults', () => {
        const res = validateJoin({ ...goodJoin, color: 'red; background:url(x)', skinId: '../../etc' })!;
        expect(res.color).toMatch(/^#[0-9a-f]{6}$/i);
        expect(res.skinId).toBe('classic');
    });

    it('keeps a valid build', () => {
        expect(validateJoin(goodJoin)!.build).toEqual(goodBuild);
    });

    it('an old client without build gets its skin preset', () => {
        const { build: _build, ...oldClient } = goodJoin;
        const res = validateJoin({ ...oldClient, skinId: 'wolf' })!;
        expect(res.build.tail).toBe('cat');
        expect(res.build.ears).toBe('cat');
    });

    it('cleans a hostile build', () => {
        const hostile = { ...goodBuild, helmet: 'laser', ears: 42, tail: { evil: true }, badgeNumber: 1e9, visorColor: 'red; background:url(x)', emblem: '../x' };
        const { build } = validateJoin({ ...goodJoin, build: hostile })!;
        expect(HELMETS).toContain(build.helmet);
        expect(EARS).toContain(build.ears);
        expect(TAILS).toContain(build.tail);
        expect(build.helmet).toBe('round'); // unknown ids fall back to the skin preset
        expect(build.badgeNumber).toBe(99);
        expect(build.visorColor).toMatch(/^#[0-9a-f]{6}$/i);
        expect(build.emblem).toBe('skull');
        expect(build.tail).toBe('none');
        expect(build.badge).toBe('number'); // the good fields stay
    });

    it('survives a build that is not an object', () => {
        for (const build of [null, 7, 'dome', []]) {
            expect(validateJoin({ ...goodJoin, build })!.build).toEqual(DEFAULT_BUILD);
        }
    });
});

describe('validateInput', () => {
    it('accepts a normal input and stamps server arrival time', () => {
        expect(validateInput(goodInput, 999)).toEqual({ ...goodInput, timestamp: 999, weaponIndex: undefined });
    });

    it.each([
        null,
        { ...goodInput, keys: null },
        { ...goodInput, mouse: { x: 'a', y: 1 } },
        { ...goodInput, mouse: { x: NaN, y: 1 } },
        { ...goodInput, mousePressed: 'yes' },
        { ...goodInput, sequence: -1 },
        { ...goodInput, sequence: 1.5 },
    ])('rejects malformed input %#', raw => {
        expect(validateInput(raw, 0)).toBeNull();
    });

    it('drops unknown keys and clamps the mouse to world bounds', () => {
        const res = validateInput({ ...goodInput, keys: { KeyA: true, Hack: true, KeyD: 'yes' }, mouse: { x: 1e12, y: -1e12 } }, 0)!;
        expect(res.keys).toEqual({ KeyA: true });
        expect(res.mouse).toEqual({ x: 10000, y: -5000 });
    });
});
