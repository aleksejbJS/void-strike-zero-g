import { describe, it, expect } from 'vitest';
import { validateJoin, validateInput } from './validation';
import { MAX_NAME_LENGTH } from './protocol';

const goodJoin = { name: 'Alex', color: '#ff0000', headColor: '#00ff00', torsoColor: '#0000ff', armColor: '#111111', legColor: '#222222', jetpackColor: '#333333', skinId: 'classic' };
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
